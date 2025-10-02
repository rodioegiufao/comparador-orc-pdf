// script.js - Versão Corrigida para Comparar Dois Excel
class SmartComparator {
    constructor() {
        this.materialsFile = null;
        this.budgetFile = null;
        this.materialsData = '';
        this.budgetData = '';
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('materialsFile').addEventListener('change', (e) => this.handleFileUpload(e, 'materials'));
        document.getElementById('budgetFile').addEventListener('change', (e) => this.handleFileUpload(e, 'budget'));
        document.getElementById('analyzeBtn').addEventListener('click', () => this.prepareForChatGPT());
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) {
            console.log('Nenhum arquivo selecionado para', type);
            return;
        }

        console.log('Arquivo selecionado:', file.name, 'Tipo:', type);
        
        const previewElement = document.getElementById(type + 'Preview');
        previewElement.innerHTML = '<p><strong>' + file.name + '</strong> - Carregando...</p>';

        try {
            if (type === 'materials') {
                this.materialsFile = file;
                this.materialsData = await this.extractExcelData(file, 'LISTA DE MATERIAIS');
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - Lista carregada</small>';
                console.log('Lista de materiais carregada com sucesso');
            } else {
                this.budgetFile = file;
                this.budgetData = await this.extractExcelData(file, 'ORÇAMENTO');
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - Orçamento carregado</small>';
                console.log('Orçamento carregado com sucesso');
            }
        } catch (error) {
            console.error('Erro ao processar ' + type + ':', error);
            previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ❌ Erro: ' + error.message + '</p>';
        } finally {
            this.checkFilesReady();
        }
    }

    async extractExcelData(file, type) {
        console.log('Extraindo dados do Excel (' + type + ')...');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let excelData = '';
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        
                        excelData += `=== ${type} - PLANILHA: ${sheetName} ===\n`;
                        
                        jsonData.forEach((row, index) => {
                            if (row && row.length > 0) {
                                // Extrai todas as colunas para análise
                                let rowText = `LINHA ${index + 1}: `;
                                row.forEach((cell, cellIndex) => {
                                    if (cell !== '' && cell !== null && cell !== undefined) {
                                        rowText += `[Col ${cellIndex + 1}] "${cell}" | `;
                                    }
                                });
                                excelData += rowText + '\n';
                            }
                        });
                        excelData += '\n';
                    });
                    
                    console.log(type + ' extraído:', excelData.length, 'caracteres');
                    resolve(excelData);
                } catch (error) {
                    console.error('Erro na extração Excel:', error);
                    reject(error);
                }
            };
            
            reader.onerror = function(error) {
                console.error('Erro no FileReader:', error);
                reject(error);
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    checkFilesReady() {
        const btn = document.getElementById('analyzeBtn');
        const isReady = this.materialsFile && this.budgetFile;
        
        btn.disabled = !isReady;
    }

    prepareForChatGPT() {
        console.log('Preparando prompt para ChatGPT...');
        
        if (!this.materialsFile || !this.budgetFile) {
            alert('❌ Por favor, carregue ambos os arquivos Excel primeiro.');
            return;
        }

        const prompt = this.createChatGPTPrompt();
        this.displayPrompt(prompt);
    }

    createChatGPTPrompt() {
        return `ANÁLISE ESPECIALIZADA: LISTA DE MATERIAIS vs ORÇAMENTO SINTÉTICO

IMPORTANTE - AMBOS OS ARQUIVOS SÃO EXCEL:

📋 LISTA DE MATERIAIS (Excel):
- Estruturado em colunas
- Contém todos os materiais necessários

📊 ORÇAMENTO SINTÉTICO (Excel):
- Estruturado em colunas  
- Contém os materiais orçados

SEU OBJETIVO: Encontrar TODAS as divergências entre os dois documentos.

DADOS PARA ANÁLISE:

=== LISTA DE MATERIAIS (EXCEL) ===
${this.materialsData}

=== ORÇAMENTO SINTÉTICO (EXCEL) ===  
${this.budgetData}

INSTRUÇÕES DETALHADAS:

1. Analise AMBOS os arquivos Excel
2. Encontre correspondências pelos nomes dos materiais
3. Compare as quantidades e unidades
4. IDENTIFIQUE:
   - 🔴 Quantidades DIFERENTES para o mesmo material
   - 🟡 Materiais na Lista mas NÃO no Orçamento (FALTANDO)
   - 🔵 Materiais no Orçamento mas NÃO na Lista (EXTRAS)

FORMATO DE RESPOSTA (OBRIGATÓRIO):

Para CADA divergência encontrada:

ITEM: [Nome do material]
LISTA DE MATERIAIS: [quantidade] [unidade]
ORÇAMENTO: [quantidade] [unidade]
DIFERENÇA: [+/- valor da diferença]
STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]

EXEMPLOS:

ITEM: CABO ELÉTRICO 2,5mm
LISTA DE MATERIAIS: 150 m
ORÇAMENTO: 120 m
DIFERENÇA: -30
STATUS: QUANTIDADE DIFERENTE

ITEM: LUMINÁRIA LED
LISTA DE MATERIAIS: 25 un
ORÇAMENTO: NÃO ENCONTRADO
DIFERENÇA: -25
STATUS: FALTANDO NO ORÇAMENTO

ITEM: PARAFUSO SExtra
LISTA DE MATERIAIS: NÃO ENCONTRADO
ORÇAMENTO: 100 un
DIFERENÇA: +100
STATUS: EXTRA NO ORÇAMENTO

REGRAS:
- Seja METICULOSO na busca por correspondências
- Calcule as diferenças numéricas
- Inclua TODOS os itens com divergência
- Mantenha este formato exato
- Ignore itens que estão iguais nos dois documentos

COMEÇE A ANÁLISE:`;
    }

    displayPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="prompt-section">
                <h3>🧠 COLE ESTE PROMPT NO CHATGPT</h3>
                
                <textarea 
                    id="chatgptPrompt" 
                    readonly 
                    class="prompt-textarea"
                >${prompt}</textarea>
                
                <button onclick="copyToClipboard()" class="copy-btn">
                    📋 Copiar Prompt para ChatGPT
                </button>
                
                <div class="instructions">
                    <h4>🎯 DICAS PARA ANÁLISE PRECISA:</h4>
                    <ul>
                        <li><strong>Ambos os arquivos são Excel</strong> - muito mais fácil de analisar!</li>
                        <li><strong>Foque</strong> em encontrar NOMES SIMILARES de materiais</li>
                        <li><strong>Ignore</strong> pequenas diferenças de escrita nos nomes</li>
                        <li><strong>Compare</strong> quantidades e unidades para cada material</li>
                    </ul>
                </div>
            </div>
        `;

        resultsSection.style.display = 'block';
        this.showResponseSection();

        window.copyToClipboard = () => {
            const textarea = document.getElementById('chatgptPrompt');
            textarea.select();
            document.execCommand('copy');
            alert('✅ Prompt copiado! Cole no ChatGPT-4 para análise.');
        };
    }

    showResponseSection() {
        const responseSection = document.getElementById('responseSection');
        responseSection.style.display = 'block';
        responseSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Funções para processar a resposta do ChatGPT
function processChatGPTResponse() {
    const responseText = document.getElementById('chatgptResponse').value.trim();
    
    if (!responseText) {
        alert('❌ Por favor, cole a resposta do ChatGPT primeiro.');
        return;
    }
    
    displayProcessedResults(responseText);
}

function displayProcessedResults(responseText) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    
    // Extrair informações da resposta
    const items = extractItemsFromResponse(responseText);
    
    resultsDisplay.innerHTML = `
        <div class="results-section">
            <h3>📊 RESULTADOS DA ANÁLISE</h3>
            
            ${items.length > 0 ? `
                <div class="summary-cards">
                    <div class="card total">
                        <h3>TOTAL DIVERGÊNCIAS</h3>
                        <div class="number">${items.length}</div>
                    </div>
                    <div class="card mismatch">
                        <h3>QUANT. DIFERENTES</h3>
                        <div class="number">${items.filter(item => item.status.includes('QUANTIDADE')).length}</div>
                    </div>
                    <div class="card missing">
                        <h3>FALTANTES</h3>
                        <div class="number">${items.filter(item => item.status.includes('FALTANDO')).length}</div>
                    </div>
                    <div class="card extra">
                        <h3>EXTRAS</h3>
                        <div class="number">${items.filter(item => item.status.includes('EXTRA')).length}</div>
                    </div>
                </div>
                
                <div class="analysis-info">
                    <h3>📋 DETALHES DAS DIVERGÊNCIAS</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Lista de Materiais</th>
                                    <th>Orçamento</th>
                                    <th>Diferença</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(item => `
                                    <tr>
                                        <td><strong>${item.item}</strong></td>
                                        <td>${item.lista}</td>
                                        <td>${item.orçamento}</td>
                                        <td class="${item.diferenca?.includes('+') ? 'difference-positive' : 'difference-negative'}">${item.diferenca}</td>
                                        <td class="status-${getStatusClass(item.status)}">${item.status}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <div class="analysis-info" style="background: #d4edda; border-left: 4px solid #28a745;">
                    <h3 style="color: #155724;">✅ NENHUMA DIVERGÊNCIA ENCONTRADA!</h3>
                    <p>Lista de materiais e orçamento estão compatíveis.</p>
                </div>
            `}
            
            <div class="actions">
                <button onclick="exportToExcel()" class="export-btn">
                    📊 Exportar para Excel
                </button>
                <button onclick="copyResults()" class="export-btn" style="background: #3498db;">
                    📋 Copiar Resultados
                </button>
            </div>
        </div>
    `;
    
    resultsDisplay.style.display = 'block';
    resultsDisplay.scrollIntoView({ behavior: 'smooth' });
}

function extractItemsFromResponse(text) {
    const items = [];
    const lines = text.split('\n');
    let currentItem = {};
    
    lines.forEach(line => {
        line = line.trim();
        
        if (line.startsWith('ITEM:')) {
            if (currentItem.item) items.push(currentItem);
            currentItem = { item: line.replace('ITEM:', '').trim() };
        }
        else if (line.startsWith('LISTA DE MATERIAIS:')) {
            currentItem.lista = line.replace('LISTA DE MATERIAIS:', '').trim();
        }
        else if (line.startsWith('ORÇAMENTO:')) {
            currentItem.orçamento = line.replace('ORÇAMENTO:', '').trim();
        }
        else if (line.startsWith('DIFERENÇA:')) {
            currentItem.diferenca = line.replace('DIFERENÇA:', '').trim();
        }
        else if (line.startsWith('STATUS:')) {
            currentItem.status = line.replace('STATUS:', '').trim();
        }
    });
    
    if (currentItem.item) items.push(currentItem);
    return items;
}

function getStatusClass(status) {
    if (status.includes('QUANTIDADE DIFERENTE')) return 'mismatch';
    if (status.includes('FALTANDO')) return 'missing';
    if (status.includes('EXTRA')) return 'extra';
    return 'missing';
}

function clearResponse() {
    document.getElementById('chatgptResponse').value = '';
}

function copyResults() {
    const responseText = document.getElementById('chatgptResponse').value;
    navigator.clipboard.writeText(responseText).then(() => {
        alert('✅ Resultados copiados!');
    });
}

function exportToExcel() {
    alert('📊 Exportação para Excel será implementada em breve!');
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
});
