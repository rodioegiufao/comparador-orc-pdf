// script.js - Versão ChatGPT Direto
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
        if (!file) return;

        const previewElement = document.getElementById(type + 'Preview');
        previewElement.innerHTML = '<p><strong>' + file.name + '</strong> - Carregando...</p>';

        try {
            if (type === 'pdf') {
                this.pdfFile = file;
                this.pdfText = await this.extractPDFText(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB</small>';
            } else {
                this.excelFile = file;
                this.excelText = await this.extractExcelText(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB</small>';
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
            fullText += `--- Página ${i} ---\n${pageText}\n\n`;
        }

        return fullText;
    }

    async extractExcelText(file) {
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
                    
                    resolve(excelText);
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

    prepareForChatGPT() {
        const prompt = this.createChatGPTPrompt();
        this.displayPrompt(prompt);
    }

    createChatGPTPrompt() {
        return `ANÁLISE URGENTE: LISTA DE MATERIAIS vs ORÇAMENTO

POR FAVOR, ANALISE ESTES DOIS ARQUIVOS E IDENTIFIQUE TODAS AS DIVERGÊNCIAS:

ARQUIVO 1 - LISTA DE MATERIAIS (PDF):
"""
${this.pdfText.substring(0, 15000)}...
"""

ARQUIVO 2 - ORÇAMENTO (EXCEL):
"""
${this.excelText.substring(0, 10000)}...
"""

INSTRUÇÕES CRÍTICAS:

1. EXTRAIA TODOS OS MATERIAIS do PDF (lista de materiais)
2. IDENTIFIQUE OS CORRESPONDENTES no Excel (orçamento)  
3. ENCONTRE TODAS AS DIVERGÊNCIAS:

   ❌ QUANTIDADES DIFERENTES: Quando o mesmo material tem quantidades diferentes
   ⚠️ FALTANDO NO ORÇAMENTO: Materiais do PDF que não estão no Excel
   📋 EXTRAS NO ORÇAMENTO: Materiais do Excel que não estão no PDF

4. RETORNE APENAS UMA LISTA SIMPLES COM:

✅ Use este formato para CADA divergência:

ITEM: [Nome completo do material]
LISTA (PDF): [quantidade] [unidade]  
ORÇAMENTO (Excel): [quantidade] [unidade]
DIFERENÇA: [+/- diferença]
STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]

EXEMPLOS:

ITEM: CABO ISOLADO PP 3 X 1,5 MM2
LISTA (PDF): 312.4 m
ORÇAMENTO (Excel): 300 m  
DIFERENÇA: -12.4
STATUS: QUANTIDADE DIFERENTE

ITEM: PLUGUE FÊMEA LUMINARIA LED
LISTA (PDF): 268 un
ORÇAMENTO (Excel): NÃO ENCONTRADO
DIFERENÇA: -268
STATUS: FALTANDO NO ORÇAMENTO

ITEM: MATERIAL EXTRA EXCEL
LISTA (PDF): NÃO ENCONTRADO
ORÇAMENTO (Excel): 50 un
DIFERENÇA: +50
STATUS: EXTRA NO ORÇAMENTO

NECESSITO QUE:

- Seja COMPLETO na análise
- Inclua TODOS os itens divergentes  
- Mantenha o formato simples acima
- Não inclua itens que estão corretos
- Foque apenas nas divergências

COMEÇE AGORA:`;
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
                        <strong>💡 DICA:</strong> O ChatGPT vai analisar DIRETAMENTE seus arquivos PDF e Excel, 
                        sem depender da minha extração limitada!
                    </p>
                </div>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Define a função de copiar
        window.copyToClipboard = () => {
            const textarea = document.getElementById('chatgptPrompt');
            textarea.select();
            document.execCommand('copy');
            alert('✅ Prompt copiado! Agora cole no ChatGPT-4.');
        };
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    new SmartComparator();
    console.log('✅ Sistema ChatGPT direto inicializado!');
});
