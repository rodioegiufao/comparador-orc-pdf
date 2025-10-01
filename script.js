// script.js - Versão Simplificada
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
        document.getElementById('analyzeBtn').addEventListener('click', () => this.generatePrompt());
    }

    handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        if (type === 'pdf') {
            this.pdfFile = file;
        } else {
            this.excelFile = file;
        }

        this.updateFilePreview(type, file);
        this.checkFilesReady();
    }

    updateFilePreview(type, file) {
        const previewElement = document.getElementById(type + 'Preview');
        previewElement.innerHTML = `
            <p><strong>${file.name}</strong> ✅</p>
            <small>${(file.size / 1024).toFixed(1)} KB</small>
        `;
    }

    checkFilesReady() {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = !(this.pdfFile && this.excelFile);
    }

    generatePrompt() {
        const prompt = this.createChatGPTPrompt();
        this.displayPrompt(prompt);
    }

    createChatGPTPrompt() {
        return `ANÁLISE: LISTA DE MATERIAIS vs ORÇAMENTO

ANEXEI DOIS ARQUIVOS:
1. "lista_materiais.pdf" - Lista de Materiais em PDF
2. "orcamento.xlsx" - Orçamento em Excel

SUA TAREFA: Comparar os dois arquivos e identificar TODAS as divergências nos quantitativos.

**INFORMAÇÕES IMPORTANTES PARA AGILIZAR:**
- No Excel, as DESCRIÇÕES estão na COLUNA D
- As UNIDADES estão na COLUNA E  
- Os QUANTITATIVOS estão na COLUNA F

**O QUE PROCURAR:**
✅ Itens com quantidades DIFERENTES entre PDF e Excel
❌ Itens que estão no PDF mas NÃO estão no Excel (faltantes)
📋 Itens que estão no Excel mas NÃO estão no PDF (extras)

**FORMATO DA RESPOSTA (OBRIGATÓRIO):**

ITEM: [Nome completo do material]
LISTA (PDF): [quantidade] [unidade]
ORÇAMENTO (Excel): [quantidade] [unidade] 
DIFERENÇA: [+/- diferença numérica]
STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]

[Repita para cada divergência encontrada]

**INSTRUÇÕES:**
- Seja COMPLETO e detalhado
- Inclua TODOS os itens com divergência
- Calcule as diferenças numéricas
- Mantenha este formato exato`;
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
                    📋 Copiar Prompt
                </button>
                
                <div class="instructions">
                    <h4>📋 COMO USAR:</h4>
                    <ol>
                        <li><strong>Clique em "Copiar Prompt"</strong> acima</li>
                        <li><strong>Abra o ChatGPT-4</strong> em outra aba</li>
                        <li><strong>Cole o prompt</strong> e envie</li>
                        <li><strong>FAÇA O UPLOAD DOS ARQUIVOS</strong> como anexo no ChatGPT</li>
                        <li><strong>Aguarde a análise completa</strong></li>
                        <li><strong>Cole a resposta abaixo</strong> quando receber</li>
                    </ol>
                    
                    <p style="color: #d35400; margin-top: 10px;">
                        <strong>⚠️ IMPORTANTE:</strong> Você precisará fazer UPLOAD MANUAL dos arquivos no ChatGPT!
                    </p>
                </div>
            </div>
        `;

        resultsSection.style.display = 'block';
        this.showResponseSection();
        
        window.copyToClipboard = () => {
            const textarea = document.getElementById('chatgptPrompt');
            textarea.select();
            document.execCommand('copy');
            alert('✅ Prompt copiado! Agora cole no ChatGPT-4 e faça o upload dos arquivos.');
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
                                    <th>Lista (PDF)</th>
                                    <th>Orçamento (Excel)</th>
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
        else if (line.startsWith('LISTA (PDF):')) {
            currentItem.lista = line.replace('LISTA (PDF):', '').trim();
        }
        else if (line.startsWith('ORÇAMENTO (Excel):')) {
            currentItem.orçamento = line.replace('ORÇAMENTO (Excel):', '').trim();
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
