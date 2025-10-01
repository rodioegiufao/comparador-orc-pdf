// script.js - Versão com ChatGPT direto (CORRIGIDA)
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelData = null;
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

        const previewElement = document.getElementById(type + 'Preview');
        previewElement.innerHTML = '<p><strong>' + file.name + '</strong> - Carregando...</p>';

        try {
            if (type === 'pdf') {
                this.pdfFile = file;
                this.pdfText = await this.extractPDFText(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅<br><small>' + file.size + ' bytes - Pronto para análise</small></p>';
            } else {
                this.excelFile = file;
                this.excelData = await this.extractExcelData(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅<br><small>' + file.size + ' bytes - Pronto para análise</small></p>';
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
            const pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
            fullText += 'Página ' + i + ':\n' + pageText + '\n\n';
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
                    
                    // Extrai dados de todas as planilhas
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
            console.log('✅ Arquivos prontos para análise com ChatGPT!');
        }
    }

    async analyzeWithChatGPT() {
        this.showLoading(true);
        
        try {
            console.log('🧠 Iniciando análise com ChatGPT...');
            
            // Prepara os dados para o ChatGPT
            const analysisData = {
                pdfText: this.pdfText.substring(0, 15000), // Limita para não exceder tokens
                excelData: this.formatExcelForGPT(this.excelData),
                fileName: this.excelData.fileName
            };

            // Cria o prompt para o ChatGPT
            const prompt = this.createAnalysisPrompt(analysisData);
            
            // Mostra o prompt para o usuário
            this.displayChatGPTPrompt(prompt);
            
        } catch (error) {
            console.error('❌ Erro na análise:', error);
            alert('Erro na análise: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    formatExcelForGPT(excelData) {
        let formattedData = 'Arquivo: ' + excelData.fileName + '\n';
        formattedData += 'Planilhas: ' + excelData.sheetNames.join(', ') + '\n\n';
        
        excelData.sheetNames.forEach(function(sheetName) {
            const sheetData = excelData.sheets[sheetName];
            formattedData += '--- Planilha: ' + sheetName + ' ---\n';
            
            // Pega as primeiras 20 linhas de cada planilha para análise
            sheetData.slice(0, 20).forEach(function(row, index) {
                formattedData += 'Linha ' + (index + 1) + ': ' + JSON.stringify(row) + '\n';
            });
            
            formattedData += '\nTotal de linhas: ' + sheetData.length + '\n\n';
        });
        
        return formattedData;
    }

    createAnalysisPrompt(data) {
        return `ANÁLISE DE COMPATIBILIDADE ENTRE LISTA DE MATERIAIS E ORÇAMENTO

CONTEXTO:
Você é um especialista em análise de compatibilidade entre listas de materiais de projetos elétricos e planilhas de orçamento. Sua tarefa é comparar os itens do PDF (lista de materiais) com os itens do Excel (orçamento) e identificar discrepâncias.

DADOS DA LISTA DE MATERIAIS (PDF):
${data.pdfText.substring(0, 5000)}...

[DADOS TRUNCADOS POR LIMITE DE TOKENS - CONTINUA NO ARQUIVO ORIGINAL]

DADOS DO ORÇAMENTO (EXCEL):
${data.excelData.substring(0, 5000)}...

[DADOS TRUNCADOS POR LIMITE DE TOKENS - CONTINUA NO ARQUIVO ORIGINAL]

INSTRUÇÕES DETALHADAS:

1. IDENTIFICAÇÃO DE ITENS:
   - Extraia todos os materiais do texto do PDF, incluindo descrição, quantidade e unidade
   - Identifique os materiais na planilha Excel, procurando por correspondências

2. CRITÉRIOS DE COMPARAÇÃO:
   - Compare descrições similares (não precisa ser exato, use senso comum)
   - Verifique se as quantidades coincidem
   - Identifique unidades de medida compatíveis

3. CLASSIFICAÇÃO DOS RESULTADOS:
   - ✅ CORRETO: Item existe em ambos com mesma quantidade
   - ❌ DIVERGENTE: Item existe mas quantidade diferente
   - ⚠️ FALTANDO_NO_ORCAMENTO: Item do PDF não encontrado no Excel
   - 📋 FALTANDO_NA_LISTA: Item do Excel não encontrado no PDF

4. FORMATAÇÃO DA RESPOSTA:
Responda APENAS com um JSON válido no seguinte formato:

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
      "item": "descrição do material",
      "lista_quantidade": 0,
      "orcamento_quantidade": 0,
      "status": "CORRETO",
      "diferenca": 0,
      "observacao": "explicação detalhada"
    }
  ],
  "recomendacoes": [
    "lista de ações recomendadas"
  ]
}

5. OBSERVAÇÕES IMPORTANTES:
   - Seja flexível na comparação de descrições
   - Considere sinônimos e abreviações
   - Priorize a lógica sobre a exatidão textual
   - Inclua observações úteis para cada item
   - Se não encontrar dados suficientes, retorne um JSON com valores zerados

Comece a análise agora e retorne APENAS o JSON, sem texto adicional.`;
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
                        <li>Aguarde a análise completa</li>
                        <li>Copie apenas o JSON da resposta (sem o prompt)</li>
                        <li>Cole no campo abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><strong>⚠️ Importante:</strong> Cole apenas o JSON, não cole o prompt novamente!</p>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT (Cole apenas o JSON aqui)</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui APENAS o JSON da resposta do ChatGPT..."></textarea>
                <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
                <button onclick="showExample()" class="copy-btn" style="background: #9b59b6;">📋 Ver Exemplo</button>
            </div>

            <div class="api-key-section">
                <label for="apiKey">🔑 Chave da API OpenAI (opcional):</label>
                <input type="password" id="apiKey" placeholder="sk-...">
                <small>Se preferir análise automática via API</small>
                <button onclick="analyzeWithAPI()" class="analyze-btn" style="margin-top: 10px;">🤖 Analisar com API</button>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Métodos auxiliares
    getStatusClass(status) {
        const statusMap = {
            'CORRETO': 'status-match',
            'DIVERGENTE': 'status-mismatch', 
            'FALTANDO_NO_ORCAMENTO': 'status-missing',
            'FALTANDO_NA_LISTA': 'status-extra'
        };
        return statusMap[status] || 'status-missing';
    }

    getStatusIcon(status) {
        const iconMap = {
            'CORRETO': '✅',
            'DIVERGENTE': '❌',
            'FALTANDO_NO_ORCAMENTO': '⚠️',
            'FALTANDO_NA_LISTA': '📋'
        };
        return iconMap[status] || '❓';
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    bindDynamicEvents() {
        // Adiciona eventos aos botões de filtro
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const filter = e.target.getAttribute('data-filter');
                this.filterTable(filter);
                
                // Atualiza estado ativo dos botões
                filterButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    filterTable(filter) {
        const rows = document.querySelectorAll('#comparisonTable tbody tr');
        
        rows.forEach(row => {
            const statusCell = row.querySelector('td:first-child');
            const status = statusCell.textContent.trim();
            
            let show = false;
            
            switch(filter) {
                case 'all':
                    show = true;
                    break;
                case 'CORRETO':
                    show = status === '✅';
                    break;
                case 'DIVERGENTE':
                    show = status === '❌';
                    break;
                case 'FALTANDO':
                    show = status === '⚠️' || status === '📋';
                    break;
                default:
                    show = true;
            }
            
            row.style.display = show ? '' : 'none';
        });
    }

    displayResults(resultData) {
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
                            <th width="100">Lista (Qtd)</th>
                            <th width="100">Orçamento (Qtd)</th>
                            <th width="80">Diferença</th>
                            <th width="200">Observação</th>
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
                    <td title="${item.item}">${this.truncateText(item.item, 50)}</td>
                    <td>${item.lista_quantidade || 0}</td>
                    <td>${item.orcamento_quantidade || 0}</td>
                    <td class="${differenceClass}">${item.diferenca > 0 ? '+' : ''}${item.diferenca}</td>
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
                    ${resultData.recomendacoes.map(rec => '<li>' + rec + '</li>').join('')}
                </ul>
            </div>

            <div class="actions">
                <button onclick="exportResults()" class="export-btn">📥 Exportar Resultados</button>
                <button onclick="showRawJSON()" class="details-btn">📄 Ver JSON Completo</button>
            </div>
        `;

        resultsSection.innerHTML = resultsHTML;
        this.bindDynamicEvents();
        
        // Salva os resultados para exportação
        window.currentResults = resultData;
        
        console.log('🎉 Resultados do ChatGPT exibidos!');
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Funções globais para os botões
window.copyToClipboard = function(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
    alert('Copiado para a área de transferência!');
};

window.showExample = function() {
    const exampleJSON = {
        "resumo": {
            "total_itens_pdf": 15,
            "total_itens_excel": 18,
            "itens_corretos": 10,
            "itens_divergentes": 3,
            "itens_faltando_orcamento": 2,
            "itens_faltando_lista": 3,
            "taxa_acerto": "66.7%"
        },
        "comparacao": [
            {
                "item": "Cabo elétrico 2,5mm²",
                "lista_quantidade": 100,
                "orcamento_quantidade": 100,
                "status": "CORRETO",
                "diferenca": 0,
                "observacao": "Quantidades coincidem"
            },
            {
                "item": "Disjuntor 25A",
                "lista_quantidade": 15,
                "orcamento_quantidade": 20,
                "status": "DIVERGENTE",
                "diferenca": -5,
                "observacao": "Orçamento tem 5 unidades a mais"
            }
        ],
        "recomendacoes": [
            "Verificar os 2 itens faltantes no orçamento",
            "Ajustar quantidades dos 3 itens divergentes",
            "Analisar os 3 itens extras no orçamento"
        ]
    };
    
    document.getElementById('chatgptResponse').value = JSON.stringify(exampleJSON, null, 2);
    alert('Exemplo de JSON carregado! Agora clique em "Processar Resposta" para testar.');
};

window.processGPTResponse = function() {
    const responseText = document.getElementById('chatgptResponse').value;
    if (!responseText.trim()) {
        alert('Por favor, cole a resposta do ChatGPT primeiro.');
        return;
    }

    try {
        // Tenta extrair JSON da resposta
        let jsonText = responseText.trim();
        
        // Remove possíveis markdown code blocks
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
        
        // Tenta encontrar JSON entre chaves
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }
        
        const resultData = JSON.parse(jsonText);
        
        // Valida a estrutura básica do JSON
        if (!resultData.resumo || !resultData.comparacao) {
            throw new Error('Estrutura JSON inválida. Faltam campos obrigatórios.');
        }
        
        // Chama o método da instância existente
        if (window.smartComparator) {
            window.smartComparator.displayResults(resultData);
        }
    } catch (error) {
        console.error('Erro ao processar resposta:', error);
        alert('Erro ao processar a resposta: ' + error.message + '\n\nCertifique-se de colar apenas o JSON da resposta do ChatGPT, sem o prompt original.');
    }
};

window.analyzeWithAPI = async function() {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        alert('Por favor, insira sua chave da API OpenAI.');
        return;
    }

    if (window.smartComparator) {
        window.smartComparator.showLoading(true);
    }
    
    try {
        const prompt = document.getElementById('analysisPrompt').value;
        const response = await window.smartComparator.callOpenAIAPI(apiKey, prompt);
        document.getElementById('chatgptResponse').value = response;
        window.processGPTResponse();
    } catch (error) {
        console.error('Erro na API:', error);
        alert('Erro na chamada da API: ' + error.message);
    } finally {
        if (window.smartComparator) {
            window.smartComparator.showLoading(false);
        }
    }
};

// Adiciona o método callOpenAIAPI à classe
SmartComparator.prototype.callOpenAIAPI = async function(apiKey, prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 4000
        })
    });

    if (!response.ok) {
        throw new Error('Erro da API: ' + response.statusText);
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

window.exportResults = function() {
    if (!window.currentResults) {
        alert('Nenhum resultado para exportar.');
        return;
    }

    const dataStr = JSON.stringify(window.currentResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'resultados_analise_chatgpt.json';
    link.click();
};

window.showRawJSON = function() {
    if (!window.currentResults) {
        alert('Nenhum resultado para mostrar.');
        return;
    }

    const jsonString = JSON.stringify(window.currentResults, null, 2);
    alert('JSON Completo:\n\n' + jsonString);
};

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    console.log('🚀 Comparador Inteligente com ChatGPT inicializado!');
});
