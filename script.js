// script.js - Sistema Completo com ChatGPT (CORRIGIDO)
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
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - Pronto para análise</small>';
            } else {
                this.excelFile = file;
                this.excelData = await this.extractExcelData(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - Pronto para análise</small>';
            }
        } catch (error) {
            console.error('Erro ao processar ' + type + ':', error);
            previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ❌ Erro: ' + error.message + '</p>';
        } finally {
            this.checkFilesReady();
        }
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
    }

    async analyzeWithChatGPT() {
        this.showLoading(true);
        
        try {
            console.log('Iniciando análise com ChatGPT...');
            
            const analysisData = {
                pdfText: this.pdfText,
                excelData: this.excelData
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

    createAnalysisPrompt(data) {
        let excelText = 'ARQUIVO: ' + data.excelData.fileName + '\n';
        excelText += 'PLANILHAS: ' + data.excelData.sheetNames.join(', ') + '\n\n';
        
        data.excelData.sheetNames.forEach(function(sheetName) {
            const sheetData = data.excelData.sheets[sheetName];
            excelText += '--- PLANILHA: ' + sheetName + ' ---\n';
            
            sheetData.forEach(function(row, index) {
                if (row && row.some(function(cell) { return cell !== '' && cell != null; })) {
                    excelText += 'Linha ' + (index + 1) + ': ' + JSON.stringify(row) + '\n';
                }
            });
            
            excelText += '\n';
        });

        return `ANÁLISE DE COMPATIBILIDADE: LISTA DE MATERIAIS vs ORÇAMENTO

CONTEXTO:
Você é um especialista em análise de projetos elétricos e orçamentação. Compare a lista de materiais (PDF) com a planilha de orçamento (Excel) e identifique todas as discrepâncias.

DADOS DA LISTA DE MATERIAIS (PDF):
"""
${data.pdfText}
"""

DADOS DO ORÇAMENTO (EXCEL):
"""
${excelText}
"""

INSTRUÇÕES:
1. Extraia todos os materiais do PDF com quantidades e unidades
2. Encontre correspondências no Excel
3. Classifique como: CORRETO, DIVERGENTE, FALTANDO_NO_ORCAMENTO, FALTANDO_NA_LISTA
4. Retorne APENAS JSON no formato:

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
      "item": "descrição",
      "lista_quantidade": 0,
      "orcamento_quantidade": 0,
      "unidade": "un",
      "status": "CORRETO",
      "diferenca": 0,
      "observacao": "explicação"
    }
  ],
  "recomendacoes": ["recomendações"]
}

Retorne APENAS o JSON, sem texto adicional.`;
    }

    displayChatGPTPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="prompt-section">
                <h3>🧠 Prompt para ChatGPT</h3>
                <textarea id="analysisPrompt" readonly>${prompt}</textarea>
                <button onclick="copyToClipboard('analysisPrompt')" class="copy-btn">📋 Copiar Prompt</button>
                
                <div class="instructions">
                    <p><strong>Como usar:</strong></p>
                    <ol>
                        <li>Copie o prompt acima (Ctrl+C)</li>
                        <li>Cole no ChatGPT-4</li>
                        <li>Cole a resposta JSON abaixo</li>
                        <li>Clique em "Processar Resposta"</li>
                    </ol>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui a resposta JSON do ChatGPT..."></textarea>
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
    alert('Prompt copiado!');
};

window.processGPTResponse = function() {
    const responseText = document.getElementById('chatgptResponse').value;
    if (!responseText.trim()) {
        alert('Cole a resposta do ChatGPT primeiro.');
        return;
    }

    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const resultData = JSON.parse(jsonMatch[0]);
            window.smartComparator.displayResults(resultData);
        } else {
            throw new Error('JSON não encontrado');
        }
    } catch (error) {
        alert('Erro: ' + error.message);
    }
};

// Métodos adicionais para exibir resultados
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

        <div class="table-container">
            <table id="comparisonTable">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Item</th>
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
                <td>${item.item}</td>
                <td>${item.lista_quantidade !== null ? item.lista_quantidade : '-'}</td>
                <td>${item.orcamento_quantidade !== null ? item.orcamento_quantidade : '-'}</td>
                <td class="${differenceClass}">${item.diferenca > 0 ? '+' : ''}${item.diferenca !== null ? item.diferenca : '-'}</td>
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
    `;

    resultsSection.innerHTML = resultsHTML;
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
    console.log('Sistema inicializado!');
});
