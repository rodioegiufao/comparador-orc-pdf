// script.js - Versão COMPLETA com seção de resposta
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
                fullText += `--- Página ${i} ---\n${pageText}\n\n`;
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
                    
                    let excelText = `ARQUIVO: ${file.name}\n`;
                    excelText += `PLANILHAS: ${workbook.SheetNames.join(', ')}\n\n`;
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        
                        excelText += `=== PLANILHA: ${sheetName} ===\n`;
                        jsonData.forEach((row, index) => {
                            if (row && row.length > 0) {
                                excelText += `Linha ${index + 1}: ${JSON.stringify(row)}\n`;
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
        
        console.log('Verificando arquivos:', {
            pdf: !!this.pdfFile,
            excel: !!this.excelFile,
            pronto: isReady
        });
        
        btn.disabled = !isReady;
        
        if (isReady) {
            console.log('✅ Ambos arquivos prontos! Botão habilitado.');
        }
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
        return `ANÁLISE RÁPIDA: LISTA DE MATERIAIS vs ORÇAMENTO
    
    PRECISO SABER APENAS ISSO: A LISTA DE MATERIAIS ESTÁ BATE COM O ORÇAMENTO?
    
    SE NÃO BATER, QUAIS ITENS ESTÃO COM PROBLEMAS?
    
    **INFORMAÇÕES IMPORTANTES PARA AGILIZAR:**
    - No Excel, as DESCRIÇÕES estão na COLUNA D
    - As UNIDADES estão na COLUNA E  
    - Os QUANTITATIVOS estão na COLUNA F
    
    ARQUIVO 1 - LISTA DE MATERIAIS (PDF):
    """
    ${this.pdfText}
    """
    
    ARQUIVO 2 - ORÇAMENTO (EXCEL):
    """
    ${this.excelText}
    """
    
    **RESPONDA APENAS COM ESTE FORMATO SIMPLES:**
    
    SE TUDO BATER:
    ✅ LISTA E ORÇAMENTO ESTÃO COMPATÍVEIS
    
    SE HOUVER DIVERGÊNCIAS:
    ❌ ENCONTRADAS DIVERGÊNCIAS:

    A LISTA DO PDF INFELIZMENTE SAI TUDO JUNTO, SEPARE OS MESMOS
    NÃO PRECISA ANALISAR TUDO, APENAS OS ITENS MAIS IMPORTANTES QUE ESTÃO DIFERENTES.`;
    }

    displayPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                <h3>🧠 COLE ESTE PROMPT NO CHATGPT</h3>
                
                <textarea 
                    id="chatgptPrompt" 
                    readonly 
                    style="width: 100%; height: 400px; padding: 15px; border: 2px solid #3498db; border-radius: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; background: #f8f9fa;"
                >${prompt}</textarea>
                
                <button onclick="copyToClipboard()" style="padding: 12px 25px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 15px; font-size: 16px;">
                    📋 Copiar Prompt para ChatGPT
                </button>
                
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #2196f3;">
                    <h4>📋 COMO USAR:</h4>
                    <ol>
                        <li><strong>Clique no botão acima</strong> para copiar o prompt</li>
                        <li><strong>Abra o ChatGPT-4</strong> em outra aba</li>
                        <li><strong>Cole o prompt</strong> e envie</li>
                        <li><strong>Aguarde a análise completa</strong> (pode demorar 2-3 minutos)</li>
                        <li><strong>O ChatGPT vai retornar uma lista limpa</strong> com todas as divergências</li>
                    </ol>
                    
                    <p style="color: #d35400; margin-top: 10px;">
                        <strong>💡 DICA:</strong> O ChatGPT vai analisar DIRETAMENTE seus arquivos PDF e Excel!
                    </p>
                </div>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // ✅ MOSTRAR A SEÇÃO DE RESPOSTA
        this.showResponseSection();

        // Define a função de copiar
        window.copyToClipboard = () => {
            const textarea = document.getElementById('chatgptPrompt');
            textarea.select();
            document.execCommand('copy');
            alert('✅ Prompt copiado! Agora cole no ChatGPT-4.');
        };
    }

    showResponseSection() {
        const responseSection = document.getElementById('responseSection');
        if (responseSection) {
            responseSection.style.display = 'block';
            responseSection.scrollIntoView({ behavior: 'smooth' });
            console.log('✅ Seção de resposta mostrada');
        } else {
            console.error('❌ Elemento responseSection não encontrado');
        }
    }
}

// === FUNÇÕES GLOBAIS PARA PROCESSAR RESPOSTA ===
function processChatGPTResponse() {
    const responseText = document.getElementById('chatgptResponse').value.trim();
    
    if (!responseText) {
        alert('❌ Por favor, cole a resposta do ChatGPT primeiro.');
        return;
    }
    
    console.log('Processando resposta do ChatGPT...');
    
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Processando resposta do ChatGPT...</p>
        </div>
    `;
    resultsDisplay.style.display = 'block';
    
    setTimeout(() => {
        displayProcessedResults(responseText);
    }, 1500);
}

function displayProcessedResults(responseText) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    
    const totalItems = (responseText.match(/ITEM:/g) || []).length;
    const divergencias = (responseText.match(/STATUS:.*QUANTIDADE DIFERENTE/g) || []).length;
    const faltantes = (responseText.match(/STATUS:.*FALTANDO/g) || []).length;
    const extras = (responseText.match(/STATUS:.*EXTRA/g) || []).length;
    
    resultsDisplay.innerHTML = `
        <div class="results-section">
            <h3>📊 RESULTADOS DA ANÁLISE</h3>
            
            <div class="summary-cards">
                <div class="card total">
                    <h3>TOTAL ITENS</h3>
                    <div class="number">${totalItems}</div>
                </div>
                <div class="card mismatch">
                    <h3>DIVERGÊNCIAS</h3>
                    <div class="number">${divergencias}</div>
                </div>
                <div class="card missing">
                    <h3>FALTANTES</h3>
                    <div class="number">${faltantes}</div>
                </div>
                <div class="card match">
                    <h3>EXTRAS</h3>
                    <div class="number">${extras}</div>
                </div>
            </div>
            
            <div class="analysis-info">
                <h3>📋 DETALHES DA ANÁLISE</h3>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
                    <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; max-height: 500px; overflow-y: auto;">${responseText}</pre>
                </div>
            </div>
            
            <div class="actions">
                <button onclick="exportToExcel()" class="export-btn">
                    📊 Exportar para Excel
                </button>
                <button onclick="generateReport()" class="export-btn" style="background: #9b59b6;">
                    📄 Gerar Relatório
                </button>
            </div>
        </div>
    `;
    
    resultsDisplay.scrollIntoView({ behavior: 'smooth' });
}

function clearResponse() {
    document.getElementById('chatgptResponse').value = '';
}

function exportToExcel() {
    alert('📊 Funcionalidade de exportação para Excel será implementada!');
}

function generateReport() {
    alert('📄 Funcionalidade de relatório será implementada!');
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
    console.log('✅ Sistema inicializado!');
});
