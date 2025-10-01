// script.js - Sistema com Análise Automática como Backup
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelData = null;
        this.results = null;
        this.pdfItems = [];
        this.excelItems = [];
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeWithChatGPT());
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const previewElement = document.getElementById(type + 'Preview');
        previewElement.innerHTML = '<p><strong>' + file.name + '</strong> - Carregando...</p>';

        try {
            if (type === 'pdf') {
                this.pdfFile = file;
                this.pdfText = await this.extractPDFText(file);
                this.pdfItems = this.extractPDFItems(this.pdfText);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - ' + this.pdfItems.length + ' itens detectados</small>';
            } else {
                this.excelFile = file;
                this.excelData = await this.extractExcelData(file);
                this.excelItems = this.extractExcelItems(this.excelData);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - ' + this.excelItems.length + ' itens detectados</small>';
            }
        } catch (error) {
            console.error('Erro ao processar ' + type + ':', error);
            previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ❌ Erro: ' + error.message + '</p>';
        } finally {
            this.checkFilesReady();
        }
    }

    extractPDFItems(pdfText) {
        const items = [];
        const lines = pdfText.split('\n');
        
        // Padrões para identificar itens no PDF
        const patterns = [
            /(.+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm|mm2)/i,
            /(\d+[.,]\d+|\d+)\s*(m|un|pç)\s+(.+)/i
        ];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length < 5) return;

            for (const pattern of patterns) {
                const match = trimmed.match(pattern);
                if (match) {
                    let description, quantity, unit;

                    if (pattern === patterns[1]) {
                        [, quantity, unit, description] = match;
                    } else {
                        [, description, quantity, unit] = match;
                    }

                    description = this.cleanDescription(description);
                    quantity = this.parseQuantity(quantity);
                    unit = this.normalizeUnit(unit);

                    if (description && description.length > 3 && !isNaN(quantity) && quantity > 0) {
                        // Evita duplicatas
                        const existing = items.find(item => 
                            item.description === description && item.quantity === quantity
                        );
                        
                        if (!existing) {
                            items.push({ description, quantity, unit });
                        }
                        break;
                    }
                }
            }
        });

        return items;
    }

    extractExcelItems(excelData) {
        const items = [];
        
        excelData.sheetNames.forEach(sheetName => {
            const sheet = excelData.sheets[sheetName];
            sheet.forEach((row, index) => {
                // Colunas: D=Descrição, E=Unidade, F=Quantidade
                if (row && row.length >= 6 && row[3] && row[5] && !isNaN(parseFloat(row[5]))) {
                    const description = this.cleanDescription(row[3]);
                    const quantity = this.parseQuantity(row[5]);
                    const unit = this.normalizeUnit(row[4] || 'un');

                    if (description && description.length > 3 && !isNaN(quantity) && quantity > 0) {
                        items.push({ description, quantity, unit });
                    }
                }
            });
        });

        return items;
    }

    cleanDescription(desc) {
        if (typeof desc !== 'string') return '';
        return desc
            .replace(/^[-•*]\s*/, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*,\s*/g, ', ')
            .trim();
    }

    parseQuantity(qty) {
        if (typeof qty === 'number') return qty;
        if (typeof qty === 'string') {
            return parseFloat(qty.replace(',', '.')) || 0;
        }
        return 0;
    }

    normalizeUnit(unit) {
        if (!unit) return 'un';
        const unitMap = {
            'm': 'm', 'un': 'un', 'pç': 'pç', 'mm': 'mm',
            'metro': 'm', 'unidade': 'un', 'peça': 'pç',
            'mm2': 'mm²', 'mm²': 'mm²'
        };
        return unitMap[unit.toLowerCase()] || 'un';
    }

    async extractPDFText(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += '--- PÁGINA ' + i + ' ---\n' + pageText + '\n\n';
        }

        return fullText;
    }

    async extractExcelData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const sheetsData = {};
                    workbook.SheetNames.forEach(function(sheetName) {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        sheetsData[sheetName] = jsonData;
                    });
                    
                    resolve({
                        fileName: file.name,
                        sheets: sheetsData,
                        sheetNames: workbook.SheetNames
                    });
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    checkFilesReady() {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = !(this.pdfFile && this.excelFile);
    }

    async analyzeWithChatGPT() {
        this.showLoading(true);
        
        try {
            console.log('Iniciando análise com ChatGPT...');
            
            const analysisData = {
                pdfText: this.optimizePDFText(this.pdfText),
                excelData: this.optimizeExcelData(this.excelData),
                pdfItemsCount: this.pdfItems.length,
                excelItemsCount: this.excelItems.length
            };

            const prompt = this.createAnalysisPrompt(analysisData);
            this.displayChatGPTPrompt(prompt);
            
        } catch (error) {
            console.error('Erro na análise:', error);
            alert('Erro na análise: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    optimizePDFText(pdfText) {
        return pdfText
            .split('\n')
            .filter(line => line.length > 10)
            .map(line => line.replace(/\s+/g, ' ').trim())
            .join('\n')
            .substring(0, 12000);
    }

    optimizeExcelData(excelData) {
        let excelText = 'ARQUIVO: ' + excelData.fileName + '\n';
        excelText += 'PLANILHAS: ' + excelData.sheetNames.join(', ') + '\n\n';
        
        excelData.sheetNames.forEach(sheetName => {
            const sheetData = excelData.sheets[sheetName];
            excelText += '=== PLANILHA: ' + sheetName + ' ===\n';
            
            sheetData.forEach((row, index) => {
                if (index > 0 && row && row.length >= 6) {
                    const descricao = row[3] || '';
                    const unidade = row[4] || '';
                    const quantidade = row[5] || '';
                    
                    if (descricao && quantidade && !isNaN(parseFloat(quantidade))) {
                        excelText += 'LINHA ' + (index + 1) + ': "' + descricao + '" | QTD: ' + quantidade + ' ' + unidade + '\n';
                    }
                }
            });
        });

        return excelText;
    }

    createAnalysisPrompt(data) {
        return `ANÁLISE COMPLETA DE COMPATIBILIDADE - LISTA DE MATERIAIS vs ORÇAMENTO

CONTEXTO CRÍTICO:
Você DEVE analisar TODOS os itens. Detectamos ${data.pdfItemsCount} itens no PDF e ${data.excelItemsCount} itens no Excel.

DADOS DO PDF (LISTA DE MATERIAIS):
"""
${data.pdfText}
"""

DADOS DO EXCEL (ORÇAMENTO):
"""
${data.excelData}
"""

INSTRUÇÕES ABSOLUTAS:

1. EXTRAIA TODOS OS ITENS do PDF. Formato típico: "DESCRIÇÃO QUANTIDADE UNIDADE"
2. IDENTIFIQUE TODOS OS ITENS correspondentes no Excel
3. ANALISE CADA ITEM INDIVIDUALMENTE
4. CLASSIFIQUE CORRETAMENTE:

   ✅ CORRETO: Quantidades iguais (±2% tolerância)
   ❌ DIVERGENTE: Quantidades diferentes (>2% diferença)  
   ⚠️ FALTANDO_NO_ORCAMENTO: Item do PDF AUSENTE no Excel
   📋 FALTANDO_NA_LISTA: Item do Excel AUSENTE no PDF

5. INCLUA PELO MENOS ${Math.max(data.pdfItemsCount, data.excelItemsCount)} ITENS na comparação

6. ESTRUTURA DO JSON:

{
  "resumo": {
    "total_itens_pdf": ${data.pdfItemsCount},
    "total_itens_excel": ${data.excelItemsCount},
    "itens_corretos": [número REAL],
    "itens_divergentes": [número REAL], 
    "itens_faltando_orcamento": [número REAL],
    "itens_faltando_lista": [número REAL],
    "taxa_acerto": "XX.X%"
  },
  "comparacao": [
    {
      "item": "DESCRIÇÃO COMPLETA",
      "lista_quantidade": [número ou null],
      "orcamento_quantidade": [número ou null], 
      "unidade": "un|m|pç",
      "status": "CORRETO|DIVERGENTE|FALTANDO_NO_ORCAMENTO|FALTANDO_NA_LISTA",
      "diferenca": [número],
      "observacao": "Detalhes específicos"
    }
    // ... INCLUA DEZENAS DE ITENS AQUI ...
  ],
  "recomendacoes": [
    "Ações baseadas na análise completa"
  ]
}

EXIGÊNCIAS:
- Analise ITENS SUFICIENTES para justificar os totais do resumo
- Para FALTANDO_NO_ORCAMENTO: lista_quantidade = número, orcamento_quantidade = null
- Para FALTANDO_NA_LISTA: lista_quantidade = null, orcamento_quantidade = número  
- Diferenca = orcamento_quantidade - lista_quantidade

NÃO ACEITAREI resposta com poucos itens. Analise COMPLETAMENTE.

RETORNE APENAS JSON:`;
    }

    displayChatGPTPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="prompt-section">
                <h3>🧠 Prompt para ChatGPT</h3>
                <textarea id="analysisPrompt" readonly style="height: 400px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">${prompt}</textarea>
                <button onclick="copyToClipboard('analysisPrompt')" class="copy-btn">📋 Copiar Prompt</button>
                
                <div class="instructions">
                    <p><strong>📋 Como usar (IMPORTANTE):</strong></p>
                    <ol>
                        <li>Copie TODO o prompt (Ctrl+A, Ctrl+C)</li>
                        <li>Cole no <strong>ChatGPT-4</strong></li>
                        <li>AGUARDE a análise COMPLETA (2-3 minutos)</li>
                        <li>Copie a resposta JSON INTEIRA</li>
                        <li>Cole abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><strong>📊 Dados detectados:</strong></p>
                    <ul>
                        <li>PDF: ${this.pdfItems.length} itens extraídos</li>
                        <li>Excel: ${this.excelItems.length} itens extraídos</li>
                    </ul>
                    <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px;">
                        <strong>💡 Dica:</strong> Se o ChatGPT não retornar análise completa, use o botão 
                        <strong>"🔄 Análise Automática"</strong> abaixo como alternativa.
                    </div>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui a resposta JSON COMPLETA do ChatGPT..." style="height: 200px; font-family: monospace;"></textarea>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
                    <button onclick="runAutomaticAnalysis()" class="analyze-btn">🤖 Análise Automática</button>
                    <button onclick="testWithCompleteMockData()" class="details-btn">🧪 Teste Completo</button>
                </div>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // ANÁLISE AUTOMÁTICA como fallback
    runAutomaticAnalysis() {
        this.showLoading(true);
        
        setTimeout(() => {
            try {
                const results = this.performAutomaticAnalysis();
                this.displayResults(results);
                alert('✅ Análise automática concluída! ' + results.comparacao.length + ' itens analisados.');
            } catch (error) {
                alert('❌ Erro na análise automática: ' + error.message);
            } finally {
                this.showLoading(false);
            }
        }, 1000);
    }

    performAutomaticAnalysis() {
        const comparison = [];
        const matchedExcelIndices = new Set();

        // Para cada item do PDF, busca correspondente no Excel
        this.pdfItems.forEach(pdfItem => {
            let bestMatch = null;
            let bestSimilarity = 0;

            this.excelItems.forEach((excelItem, excelIndex) => {
                const similarity = this.calculateSimilarity(pdfItem.description, excelItem.description);
                
                if (similarity > bestSimilarity && similarity > 0.6) {
                    bestSimilarity = similarity;
                    bestMatch = { item: excelItem, index: excelIndex };
                }
            });

            if (bestMatch) {
                matchedExcelIndices.add(bestMatch.index);
                const excelItem = bestMatch.item;
                
                const quantityDiff = Math.abs(pdfItem.quantity - excelItem.quantity);
                const tolerance = pdfItem.quantity * 0.02; // 2% de tolerância
                
                const status = quantityDiff <= tolerance ? 'CORRETO' : 'DIVERGENTE';
                const difference = excelItem.quantity - pdfItem.quantity;

                let observacao = '';
                if (status === 'CORRETO') {
                    observacao = `Quantidades coincidem (${pdfItem.quantity} ${pdfItem.unit})`;
                } else {
                    observacao = `PDF: ${pdfItem.quantity} ${pdfItem.unit} vs Excel: ${excelItem.quantity} ${excelItem.unit} - Diferença: ${difference}`;
                }

                comparison.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: excelItem.quantity,
                    unidade: pdfItem.unit,
                    status: status,
                    diferenca: difference,
                    observacao: observacao + ` [Similaridade: ${(bestSimilarity * 100).toFixed(0)}%]`
                });
            } else {
                // Item do PDF não encontrado no Excel
                comparison.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: null,
                    unidade: pdfItem.unit,
                    status: 'FALTANDO_NO_ORCAMENTO',
                    diferenca: -pdfItem.quantity,
                    observacao: 'Item não encontrado no orçamento'
                });
            }
        });

        // Itens do Excel que não foram encontrados no PDF
        this.excelItems.forEach((excelItem, index) => {
            if (!matchedExcelIndices.has(index)) {
                comparison.push({
                    item: excelItem.description,
                    lista_quantidade: null,
                    orcamento_quantidade: excelItem.quantity,
                    unidade: excelItem.unit,
                    status: 'FALTANDO_NA_LISTA',
                    diferenca: excelItem.quantity,
                    observacao: 'Item extra no orçamento (não está na lista)'
                });
            }
        });

        const corretos = comparison.filter(item => item.status === 'CORRETO').length;
        const divergentes = comparison.filter(item => item.status === 'DIVERGENTE').length;
        const faltandoOrcamento = comparison.filter(item => item.status === 'FALTANDO_NO_ORCAMENTO').length;
        const faltandoLista = comparison.filter(item => item.status === 'FALTANDO_NA_LISTA').length;
        const taxaAcerto = ((corretos / this.pdfItems.length) * 100).toFixed(1) + '%';

        return {
            resumo: {
                total_itens_pdf: this.pdfItems.length,
                total_itens_excel: this.excelItems.length,
                itens_corretos: corretos,
                itens_divergentes: divergentes,
                itens_faltando_orcamento: faltandoOrcamento,
                itens_faltando_lista: faltandoLista,
                taxa_acerto: taxaAcerto
            },
            comparacao: comparison,
            recomendacoes: [
                `Ajustar ${divergentes} itens com quantidades divergentes`,
                `Incluir ${faltandoOrcamento} itens faltantes no orçamento`,
                `Verificar ${faltandoLista} itens extras no Excel`,
                'Revisar todas as quantidades antes da aprovação'
            ]
        };
    }

    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);

        if (s1 === s2) return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) return 0.9;

        const words1 = s1.split(/\s+/).filter(w => w.length > 2);
        const words2 = s2.split(/\s+/).filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return 0;

        const commonWords = words1.filter(word => 
            words2.some(w2 => w2.includes(word) || word.includes(w2))
        );

        return commonWords.length / Math.max(words1.length, words2.length);
    }

    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// [MANTENHA TODAS AS OUTRAS FUNÇÕES GLOBAIS DO CÓDIGO ANTERIOR]
// window.copyToClipboard, window.processGPTResponse, window.filterTable, 
// window.exportToExcel, window.exportToJSON, etc.

// Nova função para análise automática
window.runAutomaticAnalysis = function() {
    if (!window.smartComparator) {
        alert('Sistema não inicializado.');
        return;
    }
    window.smartComparator.runAutomaticAnalysis();
};

// Novo teste com dados completos
window.testWithCompleteMockData = function() {
    const mockData = {
        "resumo": {
            "total_itens_pdf": 85,
            "total_itens_excel": 73,
            "itens_corretos": 45,
            "itens_divergentes": 28,
            "itens_faltando_orcamento": 12,
            "itens_faltando_lista": 5,
            "taxa_acerto": "52.9%"
        },
        "comparacao": [
            {
                "item": "CABO ISOLADO PP 3 X 1,5 MM2",
                "lista_quantidade": 312.4,
                "orcamento_quantidade": 312.4,
                "unidade": "m",
                "status": "CORRETO",
                "diferenca": 0,
                "observacao": "Quantidades coincidem perfeitamente"
            },
            {
                "item": "ELETRODUTO FLEXÍVEL CORRUGADO, 3/4\", INSTALADO NO PISO",
                "lista_quantidade": 82.9,
                "orcamento_quantidade": 82.9,
                "unidade": "m",
                "status": "CORRETO", 
                "diferenca": 0,
                "observacao": "Quantidades coincidem"
            },
            {
                "item": "CAIXA DE PASSAGEM PVC 4X2\"",
                "lista_quantidade": 21,
                "orcamento_quantidade": 20,
                "unidade": "un",
                "status": "DIVERGENTE",
                "diferenca": -1,
                "observacao": "PDF: 21 un vs Excel: 20 un"
            },
            {
                "item": "PLUGUE FÊMEA LUMINARIA LED",
                "lista_quantidade": 268,
                "orcamento_quantidade": null,
                "unidade": "un", 
                "status": "FALTANDO_NO_ORCAMENTO",
                "diferenca": -268,
                "observacao": "Item não encontrado no orçamento"
            },
            {
                "item": "ITEM EXTRA NO EXCEL",
                "lista_quantidade": null,
                "orcamento_quantidade": 50,
                "unidade": "un",
                "status": "FALTANDO_NA_LISTA", 
                "diferenca": 50,
                "observacao": "Item extra no orçamento"
            }
            // ... adicione mais itens mock aqui para testar
        ],
        "recomendacoes": [
            "Ajustar 28 itens com quantidades divergentes",
            "Incluir 12 itens faltantes no orçamento", 
            "Verificar 5 itens extras no Excel",
            "Realizar revisão final antes da aprovação"
        ]
    };
    
    // Adiciona mais itens mock para simular análise completa
    for (let i = 6; i <= 50; i++) {
        const statuses = ['CORRETO', 'DIVERGENTE', 'FALTANDO_NO_ORCAMENTO', 'FALTANDO_NA_LISTA'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        mockData.comparacao.push({
            "item": `ITEM EXEMPLO ${i} - MATERIAL ELÉTRICO`,
            "lista_quantidade": status !== 'FALTANDO_NA_LISTA' ? Math.random() * 100 : null,
            "orcamento_quantidade": status !== 'FALTANDO_NO_ORCAMENTO' ? Math.random() * 100 : null,
            "unidade": "un",
            "status": status,
            "diferenca": 0,
            "observacao": `Item de exemplo ${i} - Status: ${status}`
        });
    }
    
    window.smartComparator.displayResults(mockData);
    alert('✅ Teste com dados completos! ' + mockData.comparacao.length + ' itens carregados.');
};

// [MANTENHA O RESTO DO CÓDIGO IGUAL...]

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
    console.log('✅ Sistema com análise automática inicializado!');
});
