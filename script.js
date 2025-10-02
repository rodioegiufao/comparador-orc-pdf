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
    
    ESTRATÉGIA DE CORRESPONDÊNCIA - REGRAS CRÍTICAS PARA CABOS:
    
    1. **AGRUPAMENTO DE CABOS POR BITOLA:**
       - Quando encontrar cabos da MESMA BITOLA mas cores diferentes na Lista de Materiais, SOME as quantidades
       - Exemplo: 
         * Cabo 16mm² Azul: 51.2 m
         * Cabo 16mm² Branco: 51.2 m  
         * Cabo 16mm² Preto: 51.2 m
         * Cabo 16mm² Verde: 51.2 m
         * Cabo 16mm² Vermelho: 40.7 m
         → TOTAL: 51.2 + 51.2 + 51.2 + 51.2 + 40.7 = 245.5 m
    
    2. **CORRESPONDÊNCIA COM ORÇAMENTO:**
       - No Orçamento, procure por descrições como: "CABO", "16 MM²", "16mm²", "bitola 16"
       - Ignore diferenças de cores, marcas e descrições detalhadas
       - Foque na BITOLA e no TIPO DE CABO
    
    3. **PADRÕES DE BUSCA NO ORÇAMENTO:**
       - Procure por: "CABO", "FIO", "CONDUTOR", "ELÉTRICO"
       - Combine com bitolas: "1.5", "2.5", "4", "6", "10", "16", "25", "35", "50", "70", "95", "120", "150", "185", "240" mm²
       - Unidade deve ser "m" (metros)
    
    SEU OBJETIVO: Encontrar APENAS as divergências entre os dois documentos.
    
    DADOS PARA ANÁLISE:
    
    ${this.materialsData}
    
    ${this.budgetData}
    
    INSTRUÇÕES DETALHADAS:
    
    1. **NA LISTA DE MATERIAIS:** 
       - Combine "DESCRIÇÃO (F)" + "NOME DO ITEM (G)" para formar o nome completo
       - IDENTIFIQUE cabos pela BITOLA (ex: 1.5mm², 2.5mm², 16mm², etc.)
       - SOME quantidades de cabos da MESMA BITOLA, independente da cor
    
    2. **NO ORÇAMENTO:** 
       - Use "DESCRIÇÃO (D)" como referência
       - Procure por termos genéricos de cabos + bitolas
    
    3. **ENCONTRE CORRESPONDÊNCIAS:** 
       - Compare o TOTAL AGRUPADO por bitola da Lista com o valor do Orçamento
       - Seja FLEXÍVEL com nomenclaturas diferentes
    
    4. **COMPARE:** Quantidades totais por bitola
    
    5. **INCLUA APENAS ITENS COM DIVERGÊNCIA:**
       - 🔴 Quantidades DIFERENTES para o mesmo material/bitola
       - 🟡 Materiais/Bitolas na Lista mas NÃO no Orçamento (FALTANDO)
       - 🔵 Materiais/Bitolas no Orçamento mas NÃO na Lista (EXTRAS)
    
    6. **EXCLUA ITENS SEM DIVERGÊNCIA:**
       - ❌ NÃO inclua materiais que estão IGUAIS nos dois documentos
       - ❌ NÃO inclua cabos com quantidades totais iguais
    
    FORMATO DE RESPOSTA (OBRIGATÓRIO):
    
    📊 RESUMO DAS DIVERGÊNCIAS ENCONTRADAS:
    
    🚨 CABOS COM DIVERGÊNCIAS:
    
    BITOLA: [Ex: 16 mm²]
    TOTAL LISTA: [soma de todas as cores] m
    ORÇAMENTO: [quantidade] m
    DIFERENÇA: [+/- valor da diferença]
    STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]
    CORES ENCONTRADAS: [lista das cores com quantidades individuais]
    
    🚨 OUTROS MATERIAIS COM DIVERGÊNCIAS:
    
    ITEM: [Nome completo do material]
    LISTA DE MATERIAIS: [quantidade] [unidade]
    ORÇAMENTO: [quantidade] [unidade]
    DIFERENÇA: [+/- valor da diferença]
    STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]
    
    📈 RESUMO ESTATÍSTICO:
    - Total de divergências encontradas: [número]
    - Cabos com problemas: [número]
    - Materiais faltantes: [número]
    - Materiais extras: [número]
    - Diferenças de quantidade: [número]
    
    EXEMPLOS DE RESPOSTA:
    
    🚨 CABOS COM DIVERGÊNCIAS:
    
    BITOLA: 2.5 mm²
    TOTAL LISTA: 180.0 m
    ORÇAMENTO: 150.0 m
    DIFERENÇA: -30.0
    STATUS: QUANTIDADE DIFERENTE
    CORES ENCONTRADAS: Azul (60m), Vermelho (60m), Verde-amarelo (60m)
    
    BITOLA: 25 mm²
    TOTAL LISTA: 75.0 m
    ORÇAMENTO: NÃO ENCONTRADO
    DIFERENÇA: -75.0
    STATUS: FALTANDO NO ORÇAMENTO
    CORES ENCONTRADAS: Preto (75m)
    
    🚨 OUTROS MATERIAIS COM DIVERGÊNCIAS:
    
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
    
    📈 RESUMO ESTATÍSTICO:
    - Total de divergências encontradas: 4
    - Cabos com problemas: 2
    - Materiais faltantes: 2
    - Materiais extras: 1
    - Diferenças de quantidade: 1
    
    REGRAS FINAIS CRÍTICAS:
    1. Para CABOS: Agrupe por bitola, some quantidades, ignore cores
    2. Para OUTROS MATERIAIS: Mantenha análise individual
    3. Converta "pç" para "un" nas unidades
    4. Seja FLEXÍVEL com nomenclaturas diferentes
    5. Calcule TODAS as diferenças numéricas
    6. INCLUA APENAS itens com divergência
    7. EXCLUA itens que estão iguais nos dois documentos
    8. Mantenha este formato exato
    
    COMEÇE A ANÁLISE DETALHADA E MOSTRE APENAS AS DIVERGÊNCIAS:`;
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
