// script.js - Sistema Completo com ChatGPT
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelData = null;
        this.results = null;
        this.init();
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

        const previewElement = document.getElementById(`${type}Preview`);
        previewElement.innerHTML = `<p><strong>${file.name}</strong> - Carregando...</p>`;

        try {
            if (type === 'pdf') {
                this.pdfFile = file;
                this.pdfText = await this.extractPDFText(file);
                previewElement.innerHTML = `
                    <p><strong>${file.name}</strong> ✅</p>
                    <small>${(file.size / 1024).toFixed(1)} KB - Pronto para análise</small>
                    <div class="debug-info">
                        <strong>📝 Prévia do texto:</strong><br>
                        <div style="max-height: 100px; overflow-y: auto; font-size: 0.8rem; background: #f8f9fa; padding: 5px; border-radius: 3px;">
                            ${this.pdfText.substring(0, 200)}...
                        </div>
                    </div>
                `;
            } else {
                this.excelFile = file;
                this.excelData = await this.extractExcelData(file);
                previewElement.innerHTML = `
                    <p><strong>${file.name}</strong> ✅</p>
                    <small>${(file.size / 1024).toFixed(1)} KB - Pronto para análise</small>
                    <div class="debug-info">
                        <strong>📊 Estrutura:</strong><br>
                        Planilhas: ${this.excelData.sheetNames.join(', ')}<br>
                        Total de linhas: ${Object.values(this.excelData.sheets).reduce((acc, sheet) => acc + sheet.length, 0)}
                    </div>
                `;
            }
        } catch (error) {
            console.error(`Erro ao processar ${type}:`, error);
            previewElement.innerHTML = `<p><strong>${file.name}</strong> ❌ Erro: ${error.message}</p>`;
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
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const sheetsData = {};
                    workbook.SheetNames.forEach(sheetName => {
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
            console.log('✅ Arquivos prontos para análise com ChatGPT!');
        }
    }

    async analyzeWithChatGPT() {
        this.showLoading(true);
        
        try {
            console.log('🧠 Iniciando análise com ChatGPT...');
            
            const analysisData = {
                pdfText: this.pdfText,
                excelData: this.excelData
            };

            const prompt = this.createAnalysisPrompt(analysisData);
            this.displayChatGPTPrompt(prompt);
            
        } catch (error) {
            console.error('❌ Erro na análise:', error);
            alert('Erro na análise: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    createAnalysisPrompt(data) {
        // Formata dados do Excel para texto
        let excelText = `ARQUIVO: ${data.excelData.fileName}\n`;
        excelText += `PLANILHAS: ${data.excelData.sheetNames.join(', ')}\n\n`;
        
        data.excelData.sheetNames.forEach(sheetName => {
            const sheetData = data.excelData.sheets[sheetName];
            excelText += `--- PLANILHA: ${sheetName} ---\n`;
            
            // Inclui todas as linhas da planilha
            sheetData.forEach((row, index) => {
                if (row && row.some(cell => cell !== '' && cell != null)) {
                    excelText += `Linha ${index + 1}: ${JSON.stringify(row)}\n`;
                }
            });
            
            excelText += `\n`;
        });

        return `
ANÁLISE DE COMPATIBILIDADE: LISTA DE MATERIAIS vs ORÇAMENTO

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

INSTRUÇÕES DETALHADAS:

1. EXTRAÇÃO DE ITENS:
   - Do PDF: Identifique todos os materiais com suas quantidades e unidades
   - Do Excel: Encontre os materiais correspondentes e suas quantidades/orçamentos

2. CRITÉRIOS DE COMPARAÇÃO:
   - Use correspondência flexível de descrições (sinônimos, abreviações)
   - Considere unidades equivalentes (m, un, pç, mm, etc.)
   - Priorize o sentido semântico sobre a exatidão textual

3. CLASSIFICAÇÃO:
   - ✅ CORRETO: Item existe em ambos com quantidades compatíveis
   - ❌ DIVERGENTE: Item existe mas quantidades diferentes
   - ⚠️ FALTANDO_NO_ORCAMENTO: Item do PDF não encontrado no Excel
   - 📋 FALTANDO_NA_LISTA: Item do Excel não encontrado no PDF

4. FORMATAÇÃO DA RESPOSTA:
Responda APENAS com um JSON válido:

{
  "resumo": {
    "total_itens_pdf": número,
    "total_itens_excel": número,
    "itens_corretos": número,
    "itens_divergentes": número,
    "itens_faltando_orcamento": número,
    "itens_faltando_lista": número,
    "taxa_acerto": "XX%"
  },
  "comparacao": [
    {
      "item": "descrição completa do material",
      "lista_quantidade": número ou null,
      "orcamento_quantidade": número ou null,
      "unidade": "un|m|pç|etc",
      "status": "CORRETO|DIVERGENTE|FALTANDO_NO_ORCAMENTO|FALTANDO_NA_LISTA",
      "diferenca": número,
      "observacao": "explicação detalhada da comparação"
    }
  ],
  "recomendacoes": [
    "lista de ações recomendadas baseadas nas discrepâncias encontradas"
  ]
}

5. OBSERVAÇÕES IMPORTANTES:
   - Seja minucioso na extração de itens do PDF
   - Considere o contexto de projeto elétrico
   - Inclua observações úteis para correção
   - Para itens faltantes, explique onde procurar

Retorne APENAS o JSON, sem texto adicional antes ou depois.
`;
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
                        <li>Cole no ChatGPT-4 ou ChatGPT Plus</li>
                        <li>Aguarde a análise completa</li>
                        <li>Copie a resposta JSON do ChatGPT</li>
                        <li>Cole no campo abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><em>💡 Dica: Use o GPT-4 para melhor precisão na análise</em></p>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui a resposta JSON do ChatGPT..."></textarea>
                <div class="actions">
                    <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
                    <button onclick="clearResponse()" class="details-btn">🗑️ Limpar</button>
                </div>
            </div>

            <div class="api-key-section">
                <h4>🤖 Análise Automática (Opcional)</h4>
                <label for="apiKey">Chave da API OpenAI:</label>
                <input type="password" id="apiKey" placeholder="sk-..." style="width: 100%; max-width: 400px;">
                <small>Se preferir análise automática via API (requer créditos na OpenAI)</small>
                <button onclick="analyzeWithAPI()" class="analyze-btn" style="margin-top: 10px; padding: 10px 20px;">🚀 Analisar com API</button>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Funções globais
    window.copyToClipboard = (elementId) => {
        const textarea = document.getElementById(elementId);
        textarea.select();
        document.execCommand('copy');
        alert('✅ Prompt copiado para a área de transferência!');
    };

    window.clearResponse = () => {
        document.getElementById('chatgptResponse').value = '';
    };

    window.processGPTResponse = () => {
        const responseText = document.getElementById('chatgptResponse').value;
        if (!responseText.trim()) {
            alert('Por favor, cole a resposta do ChatGPT primeiro.');
            return;
        }

        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const resultData = JSON.parse(jsonMatch[0]);
                this.displayResults(resultData);
            } else {
                throw new Error('JSON não encontrado na resposta');
            }
        } catch (error) {
            console.error('Erro ao processar resposta:', error);
            alert('❌ Erro ao processar a resposta. Verifique se o ChatGPT retornou um JSON válido.\n\nErro: ' + error.message);
        }
    };

    window.analyzeWithAPI = async () => {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) {
            alert('Por favor, insira sua chave da API OpenAI.');
            return;
        }

        this.showLoading(true);
        
        try {
            const prompt = document.getElementById('analysisPrompt').value;
            const response = await this.callOpenAIAPI(apiKey, prompt);
            document.getElementById('chatgptResponse').value = response;
            window.processGPTResponse();
        } catch (error) {
            console.error('Erro na API:', error);
            alert('❌ Erro na chamada da API: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    };

    async callOpenAIAPI(apiKey, prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    displayResults(resultData) {
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
                <h3>📋 Relatório de Análise (via ChatGPT)</h3>
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
                <button class="filter-btn active" data-filter="all">Todos</button>
                <button class="filter-btn" data-filter="CORRETO">✅ Corretos</button>
                <button class="filter-btn" data-filter="DIVERGENTE">❌ Divergentes</button>
                <button class="filter-btn" data-filter="FALTANDO">⚠️ Faltantes</button>
            </div>

            <div class="table-container">
                <table id="comparisonTable">
                    <thead>
                        <tr>
                            <th width="60">Status</th>
                            <th width="300">Item</th>
                            <th width="80">Unid.</th>
                            <th width="90">Lista</th>
                            <th width="90">Orçamento</th>
                            <th width="80">Diferença</th>
                            <th>Observação</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        resultData.comparacao.forEach(item => {
            const statusClass = this.getStatusClass(item.status);
            const statusIcon = this.getStatusIcon(item.status);
            const differenceClass = item.diferenca > 0 ? 'difference-positive' : 
                                  item.diferenca < 0 ? 'difference-negative' : '';

            resultsHTML += `
                <tr>
                    <td class="${statusClass}">${statusIcon}</td>
                    <td title="${item.item}">${this.truncateText(item.item, 60)}</td>
                    <td>${item.unidade || '-'}</td>
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
                <h3>💡 Recomendações do ChatGPT</h3>
                <ul>
                    ${resultData.recomendacoes.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>

            <div class="export-section">
                <button onclick="exportResults()" class="export-btn">📥 Exportar Resultados (JSON)</button>
                <button onclick="showRawResults()" class="details-btn">🔍 Ver Dados Completos</button>
            </div>
        `;

        resultsSection.innerHTML = resultsHTML;
        this.bindDynamicEvents();
        
        console.log('🎉 Resultados do ChatGPT exibidos!');
    }

    bindDynamicEvents() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                this.filterTable(filter);
            });
        });
    }

    filterTable(filter) {
        const rows = document.querySelectorAll('#comparisonTable tbody tr');
        
        rows.forEach(row => {
            const statusCell = row.cells[0];
            const statusIcon = statusCell.textContent.trim();
            
            let showRow = false;
            
            switch (filter) {
                case 'all':
                    showRow = true;
                    break;
                case 'CORRETO':
                    showRow = statusIcon === '✅';
                    break;
                case 'DIVERGENTE':
                    showRow = statusIcon === '❌';
                    break;
                case 'FALTANDO':
                    showRow = statusIcon === '⚠️' || statusIcon === '📋';
                    break;
            }
            
            row.style.display = showRow ? '' : 'none';
        });
    }

    getStatusClass(status) {
        const classes = {
            'CORRETO': 'status-match',
            'DIVERGENTE': 'status-mismatch',
            'FALTANDO_NO_ORCAMENTO': 'status-missing',
            'FALTANDO_NA_LISTA': 'status-extra'
        };
        return classes[status] || '';
    }

    getStatusIcon(status) {
        const icons = {
            'CORRETO': '✅',
            'DIVERGENTE': '❌',
            'FALTANDO_NO_ORCAMENTO': '⚠️',
            'FALTANDO_NA_LISTA': '📋'
        };
        return icons[status] || '🔍';
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Funções globais para exportação
window.exportResults = () => {
    if (!window.smartComparator || !window.smartComparator.results) {
        alert('Nenhum resultado para exportar.');
        return;
    }
    
    const dataStr = JSON.stringify(window.smartComparator.results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `analise_chatgpt_${new Date().getTime()}.json`;
    link.click();
};

window.showRawResults = () => {
    if (!window.smartComparator || !window.smartComparator.results) {
        alert('Nenhum resultado disponível.');
        return;
    }
    
    alert('Dados completos disponíveis no console (F12)');
    console.log('📊 Resultados completos:', window.smartComparator.results);
};

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    window.smartComparator = new SmartComparator();
    console.log('🚀 Comparador Inteligente com ChatGPT inicializado!');
});
