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
    
        const apiKey = document.getElementById("apiKey").value.trim();
        if (!apiKey) {
            alert("⚠️ Digite sua API Key da OpenAI antes de continuar.");
            return;
        }
    
        // Resto do código permanece igual...
        const prompt = this.createChatGPTPrompt();
        
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
                    model: "gpt-4o-mini",
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
    
    🎯 ESTRATÉGIA DE ANÁLISE INTELIGENTE:
    
    1. **IDENTIFICAÇÃO DE CABOS UNIPOLARES:**
       - Procure por padrões: "mm²", "mm2", "bitola" seguido de números
       - Agrupe por BITOLA: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120 mm²
       - Some TODOS os cabos da MESMA BITOLA, independente da cor
    
    2. **CORRESPONDÊNCIA FLEXÍVEL:**
       - Para cabos unipolares: Compare BITOLAS (ex: 2.5mm² da Lista = "CABO...2,5 MM²" do Orçamento)
       - Para outros materiais: Busque por palavras-chave similares
       - Seja FLEXÍVEL com diferenças de texto, mas RIGOROSO com quantidades
    
    3. **TOLERÂNCIA PARA PEQUENAS DIFERENÇAS:**
       - Ignore diferenças menores que 1 unidade
       - Considere "PRATICAMENTE IGUAL" quando diferença < 0.1%
    
    DADOS PARA ANÁLISE:
    
    ${this.materialsData}
    
    ${this.budgetData}
    
    🔍 INSTRUÇÕES DE ANÁLISE:
    
    1. **PRIMEIRO: Identifique todos os cabos unipolares na Lista de Materiais**
       - Agrupe por bitola
       - Some as quantidades de cada bitola
       - Registre as cores individuais encontradas
    
    2. **SEGUNDO: Encontre correspondências no Orçamento**
       - Para cabos: procure por descrições com a mesma bitola
       - Para outros materiais: busque por nomes similares
    
    3. **TERCEIRO: Identifique divergências SIGNIFICATIVAS**
       - Materiais da Lista que NÃO estão no Orçamento
       - Materiais do Orçamento que NÃO estão na Lista
       - Quantidades com diferenças maiores que 1 unidade
    
    4. **QUARTO: Exclua correspondências boas**
       - Itens com quantidades iguais
       - Pequenas diferenças (< 1 unidade ou < 0.1%)
    
    📋 FORMATO DE RESPOSTA:
    
    🚨 DIVERGÊNCIAS SIGNIFICATIVAS:
    
    🔌 CABOS COM PROBLEMAS:
    
    BITOLA: [bitola] mm²
    TOTAL LISTA: [quantidade total] m
    ORÇAMENTO: [quantidade] m
    DIFERENÇA: [+/- diferença]
    STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]
    CORES ENCONTRADAS: [lista de cores com quantidades]
    
    ⚡ MATERIAIS FALTANTES NO ORÇAMENTO:
    
    ITEM: [nome do material da Lista]
    QUANTIDADE LISTA: [quantidade] [unidade]
    OBSERVAÇÃO: Material presente apenas na Lista de Materiais
    
    ⚡ MATERIAIS EXTRAS NO ORÇAMENTO:
    
    ITEM: [nome do material do Orçamento]
    QUANTIDADE ORÇAMENTO: [quantidade] [unidade]
    OBSERVAÇÃO: Material presente apenas no Orçamento
    
    🔧 OUTRAS DIVERGÊNCIAS SIGNIFICATIVAS:
    
    ITEM: [nome do material]
    LISTA DE MATERIAIS: [quantidade] [unidade]
    ORÇAMENTO: [quantidade] [unidade]
    DIFERENÇA: [+/- diferença significativa]
    STATUS: QUANTIDADE DIFERENTE
    
    📊 RESUMO:
    - Total de materiais faltantes: [número]
    - Total de materiais extras: [número]
    - Total de divergências de quantidade: [número]
    - Cabos com problemas: [número]
    
    ✅ CORRESPONDÊNCIAS ESPECÍFICAS IDENTIFICADAS (para referência):
    
    - "CABO ISOLADO PP 3 X 1,5 MM2" na Lista = "CABO ISOLADO PP 3 X 1,5 MM2 (COMPOSIÇÃO REFERÊNCIA COD 070561 AGETOP CIVIL 05/2023)" no Orçamento
    - Cabos unipolares [BITOLA] mm² na Lista = "CABO DE COBRE FLEXÍVEL ISOLADO, [BITOLA] MM²" no Orçamento
    
    🚫 NÃO INCLUIR NA RESPOSTA:
    - Itens com quantidades iguais
    - Diferenças menores que 1 unidade
    - Pequenas variações de arredondamento (< 0.1%)
    - Itens que estão corretos nos dois documentos
    
    🎯 FOCO PRINCIPAL:
    Encontrar APENAS os problemas reais que precisam de atenção!
    
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
