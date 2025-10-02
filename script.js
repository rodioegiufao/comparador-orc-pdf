// script.js - Versão Corrigida
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
                this.materialsData = await this.extractMaterialsData(file);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - Lista carregada</small>';
                console.log('Lista de materiais carregada com sucesso');
            } else {
                this.budgetFile = file;
                this.budgetData = await this.extractBudgetData(file);
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

    async extractMaterialsData(file) {
        console.log('Extraindo dados da LISTA DE MATERIAIS...');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let materialsData = '=== LISTA DE MATERIAIS ===\n';
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        
                        materialsData += `PLANILHA: ${sheetName}\n`;
                        materialsData += 'LINHA | DESCRIÇÃO (F) | ITEM (G) | QUANTIDADE (H) | UNIDADE (I)\n';
                        materialsData += '----------------------------------------------------------------\n';
                        
                        jsonData.forEach((row, index) => {
                            if (row && row.length > 0) {
                                const descricao = row[5] || '';
                                const item = row[6] || '';
                                const quantidade = row[7] || '';
                                let unidade = row[8] || '';
                                
                                if (unidade.toLowerCase() === 'pç' || unidade.toLowerCase() === 'pc') {
                                    unidade = 'un';
                                }
                                
                                if (descricao || item || quantidade || unidade) {
                                    materialsData += `LINHA ${index + 1}: "${descricao}" | "${item}" | ${quantidade} | ${unidade}\n`;
                                }
                            }
                        });
                        materialsData += '\n';
                    });
                    
                    console.log('Lista de materiais extraída:', materialsData.length, 'caracteres');
                    resolve(materialsData);
                } catch (error) {
                    console.error('Erro na extração da lista de materiais:', error);
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

    async extractBudgetData(file) {
        console.log('Extraindo dados do ORÇAMENTO SINTÉTICO...');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let budgetData = '=== ORÇAMENTO SINTÉTICO ===\n';
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                        
                        budgetData += `PLANILHA: ${sheetName}\n`;
                        budgetData += 'LINHA | DESCRIÇÃO (D) | UNIDADE (E) | QUANTIDADE (F)\n';
                        budgetData += '----------------------------------------------------\n';
                        
                        jsonData.forEach((row, index) => {
                            if (row && row.length > 0) {
                                const descricao = row[3] || '';
                                const unidade = row[4] || '';
                                const quantidade = row[5] || '';
                                
                                if (descricao || unidade || quantidade) {
                                    budgetData += `LINHA ${index + 1}: "${descricao}" | ${unidade} | ${quantidade}\n`;
                                }
                            }
                        });
                        budgetData += '\n';
                    });
                    
                    console.log('Orçamento extraído:', budgetData.length, 'caracteres');
                    resolve(budgetData);
                } catch (error) {
                    console.error('Erro na extração do orçamento:', error);
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

    async prepareForChatGPT() {
        console.log('Preparando prompt para ChatGPT...');
    
        if (!this.materialsFile || !this.budgetFile) {
            alert('❌ Por favor, carregue ambos os arquivos Excel primeiro.');
            return;
        }
    
        const prompt = this.createChatGPTPrompt();
        this.displayPrompt(prompt);
    
        const apiKey = document.getElementById("apiKey").value.trim();
        if (!apiKey) {
            alert("⚠️ Digite sua API Key da OpenAI antes de continuar.");
            return;
        }
    
        // Mostra loading
        document.getElementById("loading").style.display = "block";
    
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",   // pode trocar para gpt-4.1, gpt-4o, etc.
                    messages: [
                        { role: "system", content: "Você é um assistente especializado em análise de divergências de planilhas." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0
                })
            });
    
            const data = await response.json();
            console.log("Resposta da OpenAI:", data);
    
            if (data.error) {
                throw new Error(data.error.message);
            }
    
            const resposta = data.choices[0].message.content;
    
            displayChatGPTResponse(resposta);
    
        } catch (err) {
            alert("❌ Erro ao consultar OpenAI: " + err.message);
            console.error(err);
        } finally {
            document.getElementById("loading").style.display = "none";
        }
    }


    createChatGPTPrompt() {
        return `ANÁLISE ESPECIALIZADA: LISTA DE MATERIAIS vs ORÇAMENTO SINTÉTICO

📋 LISTA DE MATERIAIS (Excel):
- Coluna F: DESCRIÇÃO do material
- Coluna G: NOME DO ITEM
- Coluna H: QUANTIDADE
- Coluna I: UNIDADE (converta "pç" para "un")

📊 ORÇAMENTO SINTÉTICO (Excel):
- Coluna D: DESCRIÇÃO do material
- Coluna E: UNIDADE
- Coluna F: QUANTIDADE

ESTRATÉGIA DE CORRESPONDÊNCIA:
Para encontrar correspondências, você deve considerar que:
- A "DESCRIÇÃO" + "NOME DO ITEM" da Lista de Materiais deve corresponder à "DESCRIÇÃO" do Orçamento
- Exemplo: Se na Lista tiver "Cabo" + "Elétrico 2,5mm" e no Orçamento tiver "Cabo Elétrico 2,5mm", são o mesmo material

SEU OBJETIVO: Encontrar TODAS as divergências entre os dois documentos.

DADOS PARA ANÁLISE:

${this.materialsData}

${this.budgetData}

INSTRUÇÕES DETALHADAS:

1. NA LISTA DE MATERIAIS: Combine "DESCRIÇÃO (F)" + "NOME DO ITEM (G)" para formar o nome completo do material
2. NO ORÇAMENTO: Use "DESCRIÇÃO (D)" como referência
3. ENCONTRE CORRESPONDÊNCIAS: Compare os nomes completos dos materiais (seja flexível com pequenas diferenças)
4. COMPARE: Quantidades e unidades
5. IDENTIFIQUE:
   - 🔴 Quantidades DIFERENTES para o mesmo material
   - 🟡 Materiais na Lista mas NÃO no Orçamento (FALTANDO)
   - 🔵 Materiais no Orçamento mas NÃO na Lista (EXTRAS)

FORMATO DE RESPOSTA (OBRIGATÓRIO):

Para CADA divergência encontrada:

ITEM: [Nome completo do material - combinação Descrição + Item quando aplicável]
LISTA DE MATERIAIS: [quantidade] [unidade]
ORÇAMENTO: [quantidade] [unidade]
DIFERENÇA: [+/- valor da diferença]
STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]

EXEMPLOS:

ITEM: Cabo Elétrico 2,5mm
LISTA DE MATERIAIS: 150 m
ORÇAMENTO: 120 m
DIFERENÇA: -30
STATUS: QUANTIDADE DIFERENTE

ITEM: Luminária LED 20W
LISTA DE MATERIAIS: 25 un
ORÇAMENTO: NÃO ENCONTRADO
DIFERENÇA: -25
STATUS: FALTANDO NO ORÇAMENTO

ITEM: Parafuso Sextavado
LISTA DE MATERIAIS: NÃO ENCONTRADO
ORÇAMENTO: 100 un
DIFERENÇA: +100
STATUS: EXTRA NO ORÇAMENTO

REGRAS CRÍTICAS:
1. Combine "Descrição + Item" da Lista para comparar com "Descrição" do Orçamento
2. Converta "pç" para "un" nas unidades
3. Seja FLEXÍVEL com pequenas diferenças nos nomes (abreviações, maiúsculas, etc.)
4. Calcule TODAS as diferenças numéricas
5. Inclua TODOS os itens com divergência
6. Mantenha este formato exato
7. Ignore itens que estão iguais nos dois documentos

COMEÇE A ANÁLISE DETALHADA:`;
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
                    <h4>🎯 ESTRATÉGIA DE CORRESPONDÊNCIA:</h4>
                    <ul>
                        <li><strong>Lista de Materiais:</strong> Combine "Descrição (F)" + "Item (G)"</li>
                        <li><strong>Orçamento:</strong> Use apenas "Descrição (D)"</li>
                        <li><strong>Unidades:</strong> "pç" é automaticamente convertido para "un"</li>
                        <li><strong>Seja flexível</strong> com pequenas diferenças nos nomes dos materiais</li>
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

// FUNÇÃO CORRIGIDA - Agora vai mostrar a resposta
function processChatGPTResponse() {
    const responseText = document.getElementById('chatgptResponse').value.trim();
    
    if (!responseText) {
        alert('❌ Por favor, cole a resposta do ChatGPT primeiro.');
        return;
    }
    
    // CORREÇÃO: Chamar a função correta
    displayChatGPTResponse(responseText);
}

// FUNÇÃO CORRIGIDA - Exibe a resposta do ChatGPT
function displayChatGPTResponse(responseText) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    
    // CORREÇÃO: Usar innerHTML corretamente
    resultsDisplay.innerHTML = `
        <div class="results-section">
            <h3>📊 RESPOSTA DO CHATGPT</h3>
            
            <div class="chatgpt-response">
                <pre>${responseText}</pre>
            </div>
            
            <div class="actions" style="margin-top: 20px;">
                <button onclick="copyResults()" class="export-btn" style="background: #3498db;">
                    📋 Copiar Resposta
                </button>
            </div>
        </div>
    `;
    
    resultsDisplay.style.display = 'block';
    resultsDisplay.scrollIntoView({ behavior: 'smooth' });
}

function clearResponse() {
    document.getElementById('chatgptResponse').value = '';
}

function copyResults() {
    const responseText = document.getElementById('chatgptResponse').value;
    navigator.clipboard.writeText(responseText).then(() => {
        alert('✅ Resposta copiada!');
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
});
