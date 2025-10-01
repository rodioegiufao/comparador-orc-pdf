// script.js - Sistema com Exportação Excel
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelData = null;
        this.results = null;
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
                const itemCount = this.countPDFItems(this.pdfText);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - ' + itemCount + ' itens detectados</small>';
            } else {
                this.excelFile = file;
                this.excelData = await this.extractExcelData(file);
                const itemCount = this.countExcelItems(this.excelData);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - ' + itemCount + ' itens detectados</small>';
            }
        } catch (error) {
            console.error('Erro ao processar ' + type + ':', error);
            previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ❌ Erro: ' + error.message + '</p>';
        } finally {
            this.checkFilesReady();
        }
    }

    countPDFItems(pdfText) {
        // Conta itens baseado no padrão: descrição + número + unidade
        const patterns = [
            /\d+[.,]\d+\s*(m|un|pç|mm|mm2)/gi,
            /\d+\s*(m|un|pç|mm|mm2)/gi
        ];
        
        let count = 0;
        patterns.forEach(pattern => {
            const matches = pdfText.match(pattern);
            if (matches) count += matches.length;
        });
        
        return count;
    }

    countExcelItems(excelData) {
        let count = 0;
        excelData.sheetNames.forEach(sheetName => {
            const sheet = excelData.sheets[sheetName];
            sheet.forEach(row => {
                // Conta linhas que têm descrição (coluna D) e quantidade (coluna F)
                if (row && row.length >= 6 && row[3] && row[5] && !isNaN(parseFloat(row[5]))) {
                    count++;
                }
            });
        });
        return count;
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
                excelData: this.optimizeExcelData(this.excelData)
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
        // Mantém apenas as partes relevantes do PDF
        return pdfText
            .split('\n')
            .filter(line => {
                // Filtra linhas que provavelmente contêm materiais
                return line.length > 10 && 
                       (line.match(/\d+[.,]\d+\s*(m|un|pç)/i) || 
                        line.match(/[A-Z][A-Z\s]+\d/));
            })
            .map(line => line.replace(/\s+/g, ' ').trim())
            .join('\n')
            .substring(0, 10000);
    }

    optimizeExcelData(excelData) {
        let excelText = 'ARQUIVO: ' + excelData.fileName + '\n';
        excelText += 'PLANILHAS: ' + excelData.sheetNames.join(', ') + '\n\n';
        
        excelData.sheetNames.forEach(sheetName => {
            const sheetData = excelData.sheets[sheetName];
            excelText += '=== PLANILHA: ' + sheetName + ' ===\n';
            
            // Cabeçalhos
            if (sheetData.length > 0) {
                excelText += 'Cabeçalhos: ' + JSON.stringify(sheetData[0]) + '\n';
            }
            
            // Dados (colunas D, E, F são as importantes)
            sheetData.forEach((row, index) => {
                if (index > 0 && row && row.length >= 6) { // Pula cabeçalho
                    const descricao = row[3] || '';
                    const unidade = row[4] || '';
                    const quantidade = row[5] || '';
                    
                    if (descricao && quantidade && !isNaN(parseFloat(quantidade))) {
                        excelText += 'LINHA ' + (index + 1) + ': "' + descricao + '" | QTD: ' + quantidade + ' ' + unidade + '\n';
                    }
                }
            });
            
            excelText += '\n';
        });

        return excelText;
    }

    createAnalysisPrompt(data) {
        return `ANÁLISE DE COMPATIBILIDADE ENTRE LISTA DE MATERIAIS E ORÇAMENTO

OBJETIVO:
Comparar a lista de materiais do PDF com a planilha de orçamento do Excel e identificar discrepâncias.

DADOS DO PDF (LISTA DE MATERIAIS):
"""
${data.pdfText}
"""

DADOS DO EXCEL (ORÇAMENTO):
"""
${data.excelData}
"""

INSTRUÇÕES ESPECÍFICAS:

1. EXTRAIA todos os materiais do PDF. Exemplos do formato:
   - "CABO ISOLADO PP 3 X 1,5 MM2 312.4 m"
   - "CAIXA DE PASSAGEM PVC 4X2" 21 un"
   - "PLUGUE FÊMEA LUMINARIA LED 268 un"

2. IDENTIFIQUE no Excel os itens correspondentes. As colunas importantes são:
   - Coluna D: Descrição do material
   - Coluna E: Unidade (UN, M, etc.)
   - Coluna F: Quantidade

3. PARA CADA ITEM, classifique como:
   - ✅ CORRETO: Existe em ambos com mesma quantidade (±1% de tolerância)
   - ❌ DIVERGENTE: Existe mas quantidade diferente (>1% de diferença)
   - ⚠️ FALTANDO_NO_ORCAMENTO: Item do PDF não encontrado no Excel
   - 📋 FALTANDO_NA_LISTA: Item do Excel não encontrado no PDF

4. CALCULE:
   - total_itens_pdf: Total de itens únicos no PDF
   - total_itens_excel: Total de itens únicos no Excel
   - itens_corretos: Itens com quantidades iguais
   - itens_divergentes: Itens com quantidades diferentes
   - taxa_acerto: (itens_corretos / total_itens_pdf) * 100%

5. FORMATE A RESPOSTA APENAS COMO JSON:

{
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
      "item": "CAIXA DE PASSAGEM PVC 4X2",
      "lista_quantidade": 21,
      "orcamento_quantidade": 20,
      "unidade": "un",
      "status": "DIVERGENTE",
      "diferenca": -1,
      "observacao": "PDF: 21 un vs Excel: 20 un - Diferença de 1 unidade"
    }
  ],
  "recomendacoes": [
    "Ajustar quantidades dos itens divergentes",
    "Incluir itens faltantes no orçamento",
    "Verificar itens extras no Excel"
  ]
}

IMPORTANTE:
- Seja minucioso na extração de itens do PDF
- Use correspondência flexível de descrições
- Considere sinônimos e abreviações
- Inclua pelo menos 20 itens na comparação
- Retorne APENAS o JSON, sem texto adicional

COMEÇE A ANÁLISE AGORA:`;
    }

    displayChatGPTPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="prompt-section">
                <h3>🧠 Prompt para ChatGPT</h3>
                <textarea id="analysisPrompt" readonly style="height: 400px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">${prompt}</textarea>
                <button onclick="copyToClipboard('analysisPrompt')" class="copy-btn">📋 Copiar Prompt</button>
                
                <div class="instructions">
                    <p><strong>📋 Como usar:</strong></p>
                    <ol>
                        <li>Copie TODO o prompt acima (Ctrl+A, Ctrl+C)</li>
                        <li>Cole no <strong>ChatGPT-4</strong> (não use o 3.5)</li>
                        <li>Aguarde a análise completa (pode demorar 1-2 minutos)</li>
                        <li>Copie a resposta JSON do ChatGPT</li>
                        <li>Cole no campo abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><strong>📊 Dados enviados:</strong></p>
                    <ul>
                        <li>PDF: ${this.pdfText.length} caracteres (${this.countPDFItems(this.pdfText)} itens)</li>
                        <li>Excel: ${this.excelData.sheets['Orçamento Sintético'].length - 1} linhas de dados</li>
                    </ul>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui a resposta JSON do ChatGPT..." style="height: 200px; font-family: monospace;"></textarea>
                <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
                <button onclick="testWithMockData()" class="details-btn" style="margin-left: 10px;">🧪 Testar com Dados de Exemplo</button>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Funções globais
window.copyToClipboard = function(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
    alert('✅ Prompt copiado para a área de transferência!');
};

window.processGPTResponse = function() {
    const responseText = document.getElementById('chatgptResponse').value;
    if (!responseText.trim()) {
        alert('Por favor, cole a resposta do ChatGPT primeiro.');
        return;
    }

    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const resultData = JSON.parse(jsonMatch[0]);
            window.smartComparator.displayResults(resultData);
        } else {
            throw new Error('JSON não encontrado na resposta. Certifique-se de copiar TODA a resposta do ChatGPT.');
        }
    } catch (error) {
        console.error('Erro ao processar resposta:', error);
        alert('❌ Erro ao processar a resposta:\n\n' + error.message + '\n\nVerifique se copiou toda a resposta JSON do ChatGPT.');
    }
};

// Função de teste com dados mock
window.testWithMockData = function() {
    const mockData = {
        "resumo": {
            "total_itens_pdf": 30,
            "total_itens_excel": 76,
            "itens_corretos": 18,
            "itens_divergentes": 8,
            "itens_faltando_orcamento": 4,
            "itens_faltando_lista": 12,
            "taxa_acerto": "60.0%"
        },
        "comparacao": [
            {
                "item": "CABO ISOLADO PP 3 X 1,5 MM2",
                "lista_quantidade": 312.4,
                "orcamento_quantidade": 312.4,
                "unidade": "m",
                "status": "CORRETO",
                "diferenca": 0,
                "observacao": "Quantidades coincidem"
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
            }
        ],
        "recomendacoes": [
            "Ajustar quantidades dos 8 itens divergentes",
            "Incluir 4 itens faltantes no orçamento",
            "Verificar os 12 itens extras no Excel"
        ]
    };
    
    window.smartComparator.displayResults(mockData);
    alert('✅ Dados de exemplo carregados! Agora você pode testar a exportação para Excel.');
};

// Método para exibir resultados
SmartComparator.prototype.displayResults = function(resultData) {
    this.results = resultData;
    const resultsSection = document.getElementById('resultsSection');
    
    let resultsHTML = `
        <div class="summary-cards">
            <div class="card total">
                <h3>Total Itens</h3>
                <div class="number">${resultData.resumo.total_itens_pdf + resultData.resumo.total_itens_excel}</div>
            </div>
            <div class="card match">
                <h3>✅ Corretos</h3>
                <div class="number">${resultData.resumo.itens_corretos}</div>
            </div>
            <div class="card mismatch">
                <h3>❌ Divergentes</h3>
                <div class="number">${resultData.resumo.itens_divergentes}</div>
            </div>
            <div class="card missing">
                <h3>⚠️ Faltantes</h3>
                <div class="number">${resultData.resumo.itens_faltando_orcamento + resultData.resumo.itens_faltando_lista}</div>
            </div>
        </div>

        <div class="analysis-info">
            <h3>📋 Relatório de Análise</h3>
            <div class="info-grid">
                <div class="info-item">
                    <strong>Itens na Lista (PDF):</strong> ${resultData.resumo.total_itens_pdf}
                </div>
                <div class="info-item">
                    <strong>Itens no Orçamento (Excel):</strong> ${resultData.resumo.total_itens_excel}
                </div>
                <div class="info-item">
                    <strong>Taxa de Acerto:</strong> ${resultData.resumo.taxa_acerto}
                </div>
                <div class="info-item">
                    <strong>Itens Analisados:</strong> ${resultData.comparacao.length}
                </div>
            </div>
        </div>

        <div class="filters">
            <button class="filter-btn active" onclick="filterTable('all')">Todos</button>
            <button class="filter-btn" onclick="filterTable('CORRETO')">✅ Corretos</button>
            <button class="filter-btn" onclick="filterTable('DIVERGENTE')">❌ Divergentes</button>
            <button class="filter-btn" onclick="filterTable('FALTANDO')">⚠️ Faltantes</button>
        </div>

        <div class="table-container">
            <table id="comparisonTable">
                <thead>
                    <tr>
                        <th width="50">Status</th>
                        <th width="250">Item</th>
                        <th width="60">Unid.</th>
                        <th width="80">Lista</th>
                        <th width="80">Orçamento</th>
                        <th width="80">Diferença</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
    `;

    resultData.comparacao.forEach(function(item, index) {
        const statusIcon = item.status === 'CORRETO' ? '✅' : 
                          item.status === 'DIVERGENTE' ? '❌' : 
                          item.status === 'FALTANDO_NO_ORCAMENTO' ? '⚠️' : '📋';
        
        const differenceClass = item.diferenca > 0 ? 'difference-positive' : 
                              item.diferenca < 0 ? 'difference-negative' : '';

        resultsHTML += `
            <tr data-status="${item.status}" data-index="${index}">
                <td>${statusIcon}</td>
                <td title="${item.item}">${item.item.length > 60 ? item.item.substring(0, 60) + '...' : item.item}</td>
                <td>${item.unidade || '-'}</td>
                <td>${item.lista_quantidade !== null && item.lista_quantidade !== undefined ? item.lista_quantidade : '-'}</td>
                <td>${item.orcamento_quantidade !== null && item.orcamento_quantidade !== undefined ? item.orcamento_quantidade : '-'}</td>
                <td class="${differenceClass}">${item.diferenca > 0 ? '+' : ''}${item.diferenca !== null && item.diferenca !== undefined ? item.diferenca : '-'}</td>
                <td>${item.observacao}</td>
            </tr>
        `;
    });

    resultsHTML += `
                </tbody>
            </table>
        </div>

        <div class="recommendations">
            <h3>💡 Recomendações</h3>
            <ul>
                ${resultData.recomendacoes.map(function(rec) { return '<li>' + rec + '</li>'; }).join('')}
            </ul>
        </div>

        <div class="export-section">
            <button onclick="exportToExcel()" class="export-btn">📊 Exportar para Excel</button>
            <button onclick="exportToJSON()" class="details-btn">📁 Exportar JSON</button>
            <button onclick="showRawData()" class="details-btn">🔍 Ver Dados Completos</button>
        </div>
    `;

    resultsSection.innerHTML = resultsHTML;
};

// Funções de filtro
window.filterTable = function(filter) {
    const rows = document.querySelectorAll('#comparisonTable tbody tr');
    const buttons = document.querySelectorAll('.filter-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        let show = false;
        
        switch(filter) {
            case 'all': show = true; break;
            case 'CORRETO': show = status === 'CORRETO'; break;
            case 'DIVERGENTE': show = status === 'DIVERGENTE'; break;
            case 'FALTANDO': show = status.includes('FALTANDO'); break;
        }
        
        row.style.display = show ? '' : 'none';
    });
};

// Funções de exportação
window.exportToExcel = function() {
    if (!window.smartComparator || !window.smartComparator.results) {
        alert('Nenhum resultado para exportar.');
        return;
    }
    
    const results = window.smartComparator.results;
    
    // Cria workbook
    const wb = XLSX.utils.book_new();
    
    // Sheet de resumo
    const summaryData = [
        ['RELATÓRIO DE ANÁLISE DE COMPATIBILIDADE'],
        ['Data:', new Date().toLocaleDateString()],
        [],
        ['RESUMO'],
        ['Itens na Lista (PDF):', results.resumo.total_itens_pdf],
        ['Itens no Orçamento (Excel):', results.resumo.total_itens_excel],
        ['Itens Corretos:', results.resumo.itens_corretos],
        ['Itens Divergentes:', results.resumo.itens_divergentes],
        ['Itens Faltantes no Orçamento:', results.resumo.itens_faltando_orcamento],
        ['Itens Faltantes na Lista:', results.resumo.itens_faltando_lista],
        ['Taxa de Acerto:', results.resumo.taxa_acerto],
        [],
        ['RECOMENDAÇÕES'],
        ...results.recomendacoes.map(rec => [rec])
    ];
    
    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws_summary, "Resumo");
    
    // Sheet de comparação detalhada
    const comparisonData = [
        ['Status', 'Item', 'Unidade', 'Quantidade Lista', 'Quantidade Orçamento', 'Diferença', 'Observação']
    ];
    
    results.comparacao.forEach(item => {
        const status = item.status === 'CORRETO' ? 'CORRETO' : 
                      item.status === 'DIVERGENTE' ? 'DIVERGENTE' : 
                      item.status === 'FALTANDO_NO_ORCAMENTO' ? 'FALTANDO NO ORÇAMENTO' : 'FALTANDO NA LISTA';
        
        comparisonData.push([
            status,
            item.item,
            item.unidade || '-',
            item.lista_quantidade !== null && item.lista_quantidade !== undefined ? item.lista_quantidade : '-',
            item.orcamento_quantidade !== null && item.orcamento_quantidade !== undefined ? item.orcamento_quantidade : '-',
            item.diferenca !== null && item.diferenca !== undefined ? item.diferenca : '-',
            item.observacao
        ]);
    });
    
    const ws_comparison = XLSX.utils.aoa_to_sheet(comparisonData);
    XLSX.utils.book_append_sheet(wb, ws_comparison, "Comparação Detalhada");
    
    // Exporta
    const fileName = 'relatorio_analise_' + new Date().getTime() + '.xlsx';
    XLSX.writeFile(wb, fileName);
    
    alert('✅ Relatório exportado para Excel: ' + fileName);
};

window.exportToJSON = function() {
    if (!window.smartComparator || !window.smartComparator.results) {
        alert('Nenhum resultado para exportar.');
        return;
    }
    
    const dataStr = JSON.stringify(window.smartComparator.results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'analise_comparativa_' + new Date().getTime() + '.json';
    link.click();
};

window.showRawData = function() {
    if (!window.smartComparator || !window.smartComparator.results) {
        alert('Nenhum resultado disponível.');
        return;
    }
    
    console.log('📊 Dados completos:', window.smartComparator.results);
    alert('Dados completos disponíveis no console (F12 → Console)');
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
    console.log('✅ Sistema inicializado!');
});
