// script.js - Versão Simplificada
// script.js - Versão Inteligente para Formatações Diferentes
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelText = '';
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
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
            if (type === 'pdf') {
                this.pdfFile = file;
                this.pdfText = await this.extractPDFText(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - PDF carregado</small>';
                console.log('PDF carregado com sucesso');
            } else {
                this.excelFile = file;
                this.excelText = await this.extractExcelText(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - Excel carregado</small>';
                console.log('Excel carregado com sucesso');
            }
        } catch (error) {
            console.error('Erro ao processar ' + type + ':', error);
            previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ❌ Erro: ' + error.message + '</p>';
        } finally {
            this.checkFilesReady();
        }
    }

    async extractPDFText(file) {
        console.log('Extraindo texto do PDF...');
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            console.log('PDF extraído:', fullText.length, 'caracteres');
            return fullText;
        } catch (error) {
            console.error('Erro na extração PDF:', error);
            throw error;
        }
    }

    async extractExcelText(file) {
        console.log('Extraindo texto do Excel...');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let excelText = '';
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        
                        excelText += `=== PLANILHA: ${sheetName} ===\n`;
                        jsonData.forEach((row, index) => {
                            if (row && row.length > 0) {
                                // Foca nas colunas D, E, F (índices 3, 4, 5)
                                const descricao = row[3] || ''; // Coluna D
                                const unidade = row[4] || '';   // Coluna E
                                const quantidade = row[5] || ''; // Coluna F
                                
                                if (descricao || unidade || quantidade) {
                                    excelText += `LINHA ${index + 1}: "${descricao}" | ${unidade} | ${quantidade}\n`;
                                }
                            }
                        });
                        excelText += '\n';
                    });
                    
                    console.log('Excel extraído:', excelText.length, 'caracteres');
                    resolve(excelText);
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
        const isReady = this.pdfFile && this.excelFile;
        
        btn.disabled = !isReady;
    }

    prepareForChatGPT() {
        console.log('Preparando prompt para ChatGPT...');
        
        if (!this.pdfFile || !this.excelFile) {
            alert('❌ Por favor, carregue ambos os arquivos primeiro.');
            return;
        }

        const prompt = this.createChatGPTPrompt();
        this.displayPrompt(prompt);
    }

    createChatGPTPrompt() {
        return `ANÁLISE ESPECIALIZADA: LISTA DE MATERIAIS vs ORÇAMENTO

IMPORTANTE - FORMATOS DIFERENTES:

📄 PDF (LISTA DE MATERIAIS):
- Todo o texto está em BLOCO CONTÍNUO, sem quebras organizadas
- Você precisa IDENTIFICAR os materiais e quantidades no meio do texto corrido
- Procure por padrões como: "quantidade", "un", "m", "kg", números seguidos de unidades

📊 EXCEL (ORÇAMENTO):
- Estruturado em COLUNAS:
  * Coluna D: DESCRIÇÃO do material
  * Coluna E: UNIDADE (un, m, kg, etc)
  * Coluna F: QUANTIDADE numérica

SEU OBJETIVO: Encontrar TODAS as divergências entre os dois documentos.

DADOS PARA ANÁLISE:

=== PDF - LISTA DE MATERIAIS (TEXTO CORRIDO) ===
${this.pdfText}

=== EXCEL - ORÇAMENTO (ESTRUTURADO) ===  
${this.excelText}

INSTRUÇÕES DETALHADAS:

1. NO PDF: Extraia cada material e sua quantidade do texto corrido
2. NO EXCEL: Use as colunas D (descrição), E (unidade), F (quantidade)
3. COMPARE: Encontre correspondências pelos nomes dos materiais
4. IDENTIFIQUE:
   - 🔴 Quantidades DIFERENTES para o mesmo material
   - 🟡 Materiais no PDF mas NÃO no Excel (FALTANDO)
   - 🔵 Materiais no Excel mas NÃO no PDF (EXTRAS)

FORMATO DE RESPOSTA (OBRIGATÓRIO):

Para CADA divergência encontrada:

ITEM: [Nome do material]
LISTA (PDF): [quantidade] [unidade]
ORÇAMENTO (Excel): [quantidade] [unidade]
DIFERENÇA: [+/- valor da diferença]
STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]

EXEMPLOS:

ITEM: CABO ELÉTRICO 2,5mm
LISTA (PDF): 150 m
ORÇAMENTO (Excel): 120 m
DIFERENÇA: -30
STATUS: QUANTIDADE DIFERENTE

ITEM: LUMINÁRIA LED
LISTA (PDF): 25 un
ORÇAMENTO (Excel): NÃO ENCONTRADO
DIFERENÇA: -25
STATUS: FALTANDO NO ORÇAMENTO

ITEM: PARAFUSO SExtra
LISTA (PDF): NÃO ENCONTRADO
ORÇAMENTO (Excel): 100 un
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
                        <li><strong>PDF:</strong> Texto corrido - o ChatGPT precisa caçar os materiais no meio do texto</li>
                        <li><strong>Excel:</strong> Estruturado - colunas D, E, F são as importantes</li>
                        <li><strong>Foque</strong> em encontrar NOMES SIMILARES de materiais</li>
                        <li><strong>Ignore</strong> pequenas diferenças de escrita nos nomes</li>
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

// [MANTENHA AS FUNÇÕES processChatGPTResponse, displayProcessedResults, etc QUE JÁ TINHAMOS]
// ... (as funções de processamento de resposta permanecem iguais)
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
