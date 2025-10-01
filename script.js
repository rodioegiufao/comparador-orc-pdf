// script.js - Sistema Corrigido
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
                const itemCount = (this.pdfText.match(/\d+[.,]\d+\s*(m|un|pç)/gi) || []).length;
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

    countExcelItems(excelData) {
        let count = 0;
        excelData.sheetNames.forEach(sheetName => {
            const sheet = excelData.sheets[sheetName];
            sheet.forEach(row => {
                // Conta linhas que têm pelo menos descrição e quantidade
                if (row && row.length >= 5 && row[3] && row[5] && !isNaN(parseFloat(row[5]))) {
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
            fullText += pageText + '\n';
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
        
        if (!btn.disabled) {
            console.log('PDF Text length:', this.pdfText.length);
            console.log('Excel sheets:', this.excelData.sheetNames);
        }
    }

    async analyzeWithChatGPT() {
        this.showLoading(true);
        
        try {
            console.log('Iniciando análise com ChatGPT...');
            
            // Prepara dados otimizados para o ChatGPT
            const analysisData = {
                pdfText: this.optimizePDFText(this.pdfText),
                excelData: this.optimizeExcelData(this.excelData)
            };

            console.log('PDF otimizado:', analysisData.pdfText.length, 'caracteres');
            console.log('Excel otimizado:', analysisData.excelData.length, 'caracteres');

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
        // Remove linhas muito curtas e duplica espaços
        return pdfText
            .split('\n')
            .filter(line => line.trim().length > 3)
            .map(line => line.replace(/\s+/g, ' ').trim())
            .join('\n')
            .substring(0, 12000); // Limita para caber no contexto
    }

    optimizeExcelData(excelData) {
        let excelText = 'ARQUIVO: ' + excelData.fileName + '\n';
        excelText += 'PLANILHAS: ' + excelData.sheetNames.join(', ') + '\n\n';
        
        excelData.sheetNames.forEach(sheetName => {
            const sheetData = excelData.sheets[sheetName];
            excelText += '--- PLANILHA: ' + sheetName + ' ---\n';
            
            // Foca nas colunas relevantes: Descrição (D), Unidade (E), Quantidade (F)
            sheetData.forEach((row, index) => {
                if (row && row.length >= 6) {
                    const descricao = row[3] || '';
                    const unidade = row[4] || '';
                    const quantidade = row[5] || '';
                    
                    // Só inclui linhas que têm descrição e quantidade válida
                    if (descricao && quantidade && !isNaN(parseFloat(quantidade))) {
                        excelText += 'Item ' + (index + 1) + ': ' + descricao + ' | Qtd: ' + quantidade + ' ' + unidade + '\n';
                    }
                }
            });
            
            excelText += '\n';
        });

        return excelText;
    }

    createAnalysisPrompt(data) {
        return `ANÁLISE DE COMPATIBILIDADE: LISTA DE MATERIAIS (PDF) vs ORÇAMENTO (EXCEL)

CONTEXTO:
Você é um especialista em análise de projetos elétricos. Compare a LISTA DE MATERIAIS do PDF com o ORÇAMENTO do Excel e identifique discrepâncias.

DADOS DA LISTA DE MATERIAIS (PDF):
"""
${data.pdfText}
"""

DADOS DO ORÇAMENTO (EXCEL):
"""
${data.excelData}
"""

INSTRUÇÕES DETALHADAS:

1. EXTRAIA todos os materiais do PDF com suas quantidades e unidades
2. IDENTIFIQUE no Excel os itens correspondentes
3. CLASSIFIQUE cada item como:
   - ✅ CORRETO: Existe em ambos com mesma quantidade
   - ❌ DIVERGENTE: Existe mas quantidade diferente  
   - ⚠️ FALTANDO_NO_ORCAMENTO: Item do PDF não está no Excel
   - 📋 FALTANDO_NA_LISTA: Item do Excel não está no PDF

4. FORMATE a resposta APENAS como JSON:

{
  "resumo": {
    "total_itens_pdf": 0,
    "total_itens_excel": 0,
    "itens_corretos": 0,
    "itens_divergentes": 0,
    "itens_faltando_orcamento": 0,
    "itens_faltando_lista": 0,
    "taxa_acerto": "0%"
  },
  "comparacao": [
    {
      "item": "descrição completa",
      "lista_quantidade": 0,
      "orcamento_quantidade": 0,
      "unidade": "un|m|pç",
      "status": "CORRETO|DIVERGENTE|FALTANDO_NO_ORCAMENTO|FALTANDO_NA_LISTA",
      "diferenca": 0,
      "observacao": "explicação detalhada"
    }
  ],
  "recomendacoes": [
    "lista de ações recomendadas"
  ]
}

5. DICAS IMPORTANTES:
   - O PDF tem itens como: "CABO ISOLADO PP 3 X 1,5 MM2 312.4 m"
   - O Excel tem colunas: Descrição (D), Unidade (E), Quantidade (F)
   - Use correspondência flexível (ex: "CABO ISOLADO PP 3 X 1,5 MM2" = "CABO ISOLADO PP 3 X 1,5 MM2")
   - Considere unidades equivalentes

Retorne APENAS o JSON, sem texto adicional.`;
    }

    displayChatGPTPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="prompt-section">
                <h3>🧠 Prompt para ChatGPT</h3>
                <textarea id="analysisPrompt" readonly style="height: 400px; font-family: monospace; font-size: 12px;">${prompt}</textarea>
                <button onclick="copyToClipboard('analysisPrompt')" class="copy-btn">📋 Copiar Prompt</button>
                
                <div class="instructions">
                    <p><strong>Como usar:</strong></p>
                    <ol>
                        <li>Copie o prompt acima (Ctrl+A, Ctrl+C)</li>
                        <li>Cole no ChatGPT-4</li>
                        <li>Aguarde a análise completa (pode demorar 1-2 minutos)</li>
                        <li>Copie a resposta JSON do ChatGPT</li>
                        <li>Cole no campo abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><strong>📊 Dados enviados:</strong></p>
                    <ul>
                        <li>PDF: ${this.pdfText.length} caracteres</li>
                        <li>Excel: ${this.excelData ? this.excelData.sheetNames.length : 0} planilhas</li>
                    </ul>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui a resposta JSON do ChatGPT..." style="height: 200px; font-family: monospace;"></textarea>
                <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
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
            throw new Error('JSON não encontrado na resposta. Certifique-se de copiar toda a resposta do ChatGPT.');
        }
    } catch (error) {
        console.error('Erro ao processar resposta:', error);
        alert('❌ Erro ao processar a resposta:\n\n' + error.message + '\n\nVerifique se copiou toda a resposta JSON do ChatGPT.');
    }
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

        <div class="table-container">
            <table id="comparisonTable">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Item</th>
                        <th>Unid.</th>
                        <th>Lista</th>
                        <th>Orçamento</th>
                        <th>Diferença</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
    `;

    resultData.comparacao.forEach(function(item) {
        const statusIcon = item.status === 'CORRETO' ? '✅' : 
                          item.status === 'DIVERGENTE' ? '❌' : 
                          item.status === 'FALTANDO_NO_ORCAMENTO' ? '⚠️' : '📋';
        
        const differenceClass = item.diferenca > 0 ? 'difference-positive' : 
                              item.diferenca < 0 ? 'difference-negative' : '';

        resultsHTML += `
            <tr>
                <td>${statusIcon}</td>
                <td style="max-width: 300px;">${item.item}</td>
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
            <button onclick="exportResults()" class="export-btn">📥 Exportar Resultados (JSON)</button>
        </div>
    `;

    resultsSection.innerHTML = resultsHTML;
};

// Função de exportação
window.exportResults = function() {
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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
    console.log('✅ Sistema inicializado!');
});
