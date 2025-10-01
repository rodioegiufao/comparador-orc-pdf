// script.js - Versão com ChatGPT melhorada
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
                pdfText: this.pdfText,
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
        let formattedData = 'ARQUIVO EXCEL: ' + excelData.fileName + '\n';
        formattedData += 'PLANILHAS: ' + excelData.sheetNames.join(', ') + '\n\n';
        
        excelData.sheetNames.forEach(function(sheetName) {
            const sheetData = excelData.sheets[sheetName];
            formattedData += '=== PLANILHA: ' + sheetName + ' ===\n';
            
            // Procura por cabeçalhos comuns
            const headerKeywords = ['item', 'material', 'descrição', 'descricao', 'produto', 'código', 'codigo', 'quantidade', 'qtd', 'unidade', 'und', 'valor', 'preço', 'preco'];
            
            // Encontra linha de cabeçalho
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(sheetData.length, 10); i++) {
                const row = sheetData[i];
                if (Array.isArray(row)) {
                    const rowText = row.join(' ').toLowerCase();
                    if (headerKeywords.some(keyword => rowText.includes(keyword))) {
                        headerRowIndex = i;
                        break;
                    }
                }
            }
            
            // Mostra cabeçalho se encontrado
            if (headerRowIndex !== -1) {
                formattedData += 'Cabeçalho: ' + JSON.stringify(sheetData[headerRowIndex]) + '\n';
            }
            
            // Pega até 30 linhas de dados (pulando o cabeçalho se encontrado)
            const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
            const dataRows = sheetData.slice(startRow, startRow + 30);
            
            dataRows.forEach(function(row, index) {
                if (row && row.length > 0 && !row.every(cell => cell === '' || cell === null)) {
                    formattedData += 'Linha ' + (startRow + index + 1) + ': ' + JSON.stringify(row) + '\n';
                }
            });
            
            formattedData += '--- Total de linhas na planilha: ' + sheetData.length + ' ---\n\n';
        });
        
        return formattedData;
    }

    createAnalysisPrompt(data) {
        return `Você é um especialista em análise de compatibilidade entre listas de materiais de projetos elétricos e planilhas de orçamento.

SUA TAREFA:
Comparar os itens da LISTA DE MATERIAIS (PDF) com os itens do ORÇAMENTO (Excel) e identificar discrepâncias.

DADOS DA LISTA DE MATERIAIS (PDF):
"""
${data.pdfText}
"""

DADOS DO ORÇAMENTO (EXCEL):
"""
${data.excelData}
"""

INSTRUÇÕES DETALHADAS:

1. PRIMEIRO: Analise o PDF e extraia TODOS os materiais elétricos que encontrar. Procure por:
   - Cabos, fios, condutores
   - Disjuntores, interruptores, tomadas
   - Quadros, caixas, eletrodutos
   - Luminárias, lâmpadas, refletores
   - Eletrodutos, conduítes, canaletas
   - Materiais de instalação, conectores, terminais

2. PARA CADA MATERIAL DO PDF, identifique:
   - Descrição do material
   - Quantidade (procure números seguidos de unidades: m, cm, mm, un, pç, etc.)
   - Unidade de medida

3. NO EXCEL, procure pelos mesmos materiais nas planilhas. Procure em TODAS as colunas:
   - Compare descrições similares (ex: "cabo 2,5mm" = "cabo 2.5mm" = "cabo 2,5 mm")
   - Considere abreviações e sinônimos
   - Ignore diferenças de capitalização e acentuação

4. CLASSIFIQUE CADA ITEM:
   - ✅ CORRETO: Encontrado em ambos com mesma quantidade (±10% de tolerância)
   - ❌ DIVERGENTE: Encontrado mas quantidade diferente (>10% diferença)
   - ⚠️ FALTANDO_NO_ORCAMENTO: No PDF mas não encontrado no Excel
   - 📋 FALTANDO_NA_LISTA: No Excel mas não encontrado no PDF

5. SE NÃO ENCONTRAR MATERIAIS ÓBVIOS:
   - Procure por padrões comuns: números, unidades, descrições técnicas
   - Liste pelo menos os materiais mais evidentes
   - Se realmente não encontrar nada, explique o que viu nos arquivos

FORMATO DA RESPOSTA (APENAS JSON):
{
  "resumo": {
    "total_itens_pdf": número,
    "total_itens_excel": número,
    "itens_corretos": número,
    "itens_divergentes": número,
    "itens_faltando_orcamento": número,
    "itens_faltando_lista": número,
    "taxa_acerto": "porcentagem",
    "observacao_geral": "breve explicação dos resultados"
  },
  "comparacao": [
    {
      "item": "descrição clara do material",
      "lista_quantidade": número,
      "orcamento_quantidade": número,
      "status": "CORRETO|DIVERGENTE|FALTANDO_NO_ORCAMENTO|FALTANDO_NA_LISTA",
      "diferenca": número,
      "observacao": "explicação detalhada da comparação"
    }
  ],
  "recomendacoes": [
    "lista de ações recomendadas baseadas nas discrepâncias encontradas"
  ],
  "debug_info": {
    "materiais_identificados_pdf": ["lista de materiais encontrados no PDF"],
    "materiais_identificados_excel": ["lista de materiais encontrados no Excel"]
  }
}

EXEMPLOS DE MATERIAIS ELÉTRICOS COMUNS:
- Cabo PP 2,5mm² 750V - 100m
- Disjuntor bipolar 25A - 15un
- Eletroduto PVC 20mm - 50m
- Luminária LED 18W - 8un
- Tomada 2P+T 10A - 25un

COMEÇE A ANÁLISE AGORA. Retorne APENAS o JSON válido.`;
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
                        <li>Aguarde a análise completa (pode demorar 1-2 minutos)</li>
                        <li>Copie apenas o JSON da resposta (sem texto adicional)</li>
                        <li>Cole no campo abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><strong>💡 Dica:</strong> Se não encontrar materiais, tente o botão "Ver Exemplo" para testar</p>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT (Cole apenas o JSON aqui)</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui APENAS o JSON da resposta do ChatGPT..."></textarea>
                <div class="response-buttons">
                    <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
                    <button onclick="showExample()" class="copy-btn" style="background: #9b59b6;">📋 Ver Exemplo</button>
                    <button onclick="showDebugView()" class="details-btn">🐛 Visualização Debug</button>
                </div>
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

    // ... (mantém os métodos auxiliares existentes: getStatusClass, getStatusIcon, truncateText, etc.)

    displayResults(resultData) {
        const resultsSection = document.getElementById('resultsSection');
        
        // Se não encontrou itens, mostra uma view especial
        if (resultData.resumo.total_itens_pdf === 0 && resultData.resumo.total_itens_excel === 0) {
            this.displayNoItemsView(resultData);
            return;
        }

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
                        <strong>Observação:</strong> ${resultData.resumo.observacao_geral || 'Análise concluída'}
                    </div>
                </div>
            </div>
        `;

        // Só mostra a tabela se houver itens para comparar
        if (resultData.comparacao && resultData.comparacao.length > 0) {
            resultsHTML += `
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
            `;
        }

        // Recomendações
        if (resultData.recomendacoes && resultData.recomendacoes.length > 0) {
            resultsHTML += `
                <div class="recommendations">
                    <h3>💡 Recomendações do ChatGPT</h3>
                    <ul>
                        ${resultData.recomendacoes.map(rec => '<li>' + rec + '</li>').join('')}
                    </ul>
                </div>
            `;
        }

        // Botões de ação
        resultsHTML += `
            <div class="actions">
                <button onclick="exportResults()" class="export-btn">📥 Exportar Resultados</button>
                <button onclick="showRawJSON()" class="details-btn">📄 Ver JSON Completo</button>
                ${resultData.debug_info ? '<button onclick="showDebugInfo()" class="debug-btn">🐛 Info Debug</button>' : ''}
            </div>
        `;

        resultsSection.innerHTML = resultsHTML;
        
        if (resultData.comparacao && resultData.comparacao.length > 0) {
            this.bindDynamicEvents();
        }
        
        // Salva os resultados para exportação
        window.currentResults = resultData;
        
        console.log('🎉 Resultados do ChatGPT exibidos!');
    }

    displayNoItemsView(resultData) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="no-items-view">
                <div class="warning-icon">⚠️</div>
                <h3>Nenhum Material Identificado</h3>
                <p>O ChatGPT não conseguiu identificar materiais elétricos nos arquivos fornecidos.</p>
                
                <div class="suggestions">
                    <h4>Possíveis causas:</h4>
                    <ul>
                        <li>Os arquivos podem não conter lista de materiais elétricos</li>
                        <li>Formatação diferente do esperado</li>
                        <li>Texto em imagem (PDF escaneado)</li>
                        <li>Nomenclatura muito específica</li>
                    </ul>
                    
                    <h4>Sugestões:</h4>
                    <ol>
                        <li>Verifique se os arquivos contêm lista de materiais elétricos</li>
                        <li>Tente arquivos com formatação mais simples</li>
                        <li>Use o botão "Visualização Debug" para ver o que foi extraído</li>
                        <li>Teste com o exemplo clicando em "Ver Exemplo"</li>
                    </ol>
                </div>
                
                <div class="actions">
                    <button onclick="showDebugView()" class="debug-btn">🐛 Visualização Debug</button>
                    <button onclick="showExample()" class="copy-btn">📋 Ver Exemplo</button>
                    <button onclick="showRawJSON()" class="details-btn">📄 Ver Resposta Completa</button>
                </div>
            </div>
        `;
        
        window.currentResults = resultData;
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// ... (mantém as funções globais existentes e adiciona as novas)

window.showDebugView = function() {
    if (!window.smartComparator) return;
    
    const debugInfo = `
        <h3>🐛 Informações de Debug</h3>
        
        <div class="debug-section">
            <h4>PDF Texto (primeiros 1000 caracteres):</h4>
            <div class="debug-content">
                <pre>${window.smartComparator.pdfText ? window.smartComparator.pdfText.substring(0, 1000) + '...' : 'Nenhum texto extraído'}</pre>
            </div>
        </div>
        
        <div class="debug-section">
            <h4>Excel Estrutura:</h4>
            <div class="debug-content">
                <pre>${window.smartComparator.excelData ? JSON.stringify(window.smartComparator.excelData, null, 2).substring(0, 1500) + '...' : 'Nenhum dado extraído'}</pre>
            </div>
        </div>
        
        <div class="debug-section">
            <h4>Prompt Enviado (primeiros 500 caracteres):</h4>
            <div class="debug-content">
                <pre>${document.getElementById('analysisPrompt') ? document.getElementById('analysisPrompt').value.substring(0, 500) + '...' : 'Nenhum prompt gerado'}</pre>
            </div>
        </div>
    `;
    
    alert(debugInfo);
};

window.showDebugInfo = function() {
    if (!window.currentResults || !window.currentResults.debug_info) {
        alert('Nenhuma informação de debug disponível.');
        return;
    }
    
    const debugInfo = window.currentResults.debug_info;
    let debugHTML = '<h3>🐛 Informações de Debug do ChatGPT</h3>';
    
    if (debugInfo.materiais_identificados_pdf) {
        debugHTML += '<h4>Materiais Identificados no PDF:</h4><ul>';
        debugInfo.materiais_identificados_pdf.forEach(item => {
            debugHTML += '<li>' + item + '</li>';
        });
        debugHTML += '</ul>';
    }
    
    if (debugInfo.materiais_identificados_excel) {
        debugHTML += '<h4>Materiais Identificados no Excel:</h4><ul>';
        debugInfo.materiais_identificados_excel.forEach(item => {
            debugHTML += '<li>' + item + '</li>';
        });
        debugHTML += '</ul>';
    }
    
    alert(debugHTML);
};

// ... (restante das funções globais permanece igual)
