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
    
    ESTRATÉGIA DE CORRESPONDÊNCIA - REGRAS CRÍTICAS:
    
    1. **CABOS UNIPOLARES (Lista de Materiais):**
       - Agrupe por BITOLA específica: 1.5mm², 2.5mm², 4mm², 16mm²
       - SOME apenas cabos da MESMA BITOLA
       - Exemplo para 2.5mm²: Some apenas as linhas que têm "2.5 mm²" no Item
       - Exemplo para 4mm²: Some apenas as linhas que têm "4 mm²" no Item
    
    2. **CABOS MULTICONDUCTORES (Orçamento):**
       - Procure por cabos multipolares como: "CABO ISOLADO PP 3 X 1,5 MM2" = 3 condutores de 1.5mm²
       - Para cabos multipolares, a bitola é individual por condutor
    
    3. **CORRESPONDÊNCIA EXATA:**
       - Para cada material, busque correspondência EXATA pelo nome/descrição
       - Seja FLEXÍVEL com pequenas variações de texto
    
    SEU OBJETIVO: Encontrar APENAS as DIVERGÊNCIAS entre os dois documentos.
    
    DADOS PARA ANÁLISE:
    
    ${this.materialsData}
    
    ${this.budgetData}
    
    INSTRUÇÕES DETALHADAS:
    
    1. **ANÁLISE DE CABOS UNIPOLARES:**
       - Identifique cada bitola separadamente (1.5mm², 2.5mm², 4mm², 16mm²)
       - Some APENAS os cabos da MESMA BITOLA
       - NÃO some bitolas diferentes
    
    2. **BUSCA NO ORÇAMENTO:**
       - Para cabos unipolares: procure por "CABO DE COBRE FLEXÍVEL ISOLADO" + bitola
       - Para cabos multipolares: procure pela descrição exata
       - Compare quantidades totais por bitola
    
    3. **CRITÉRIOS DE INCLUSÃO:**
       - INCLUA APENAS itens com: Quantidades DIFERENTES, FALTANTES ou EXTRAS
       - EXCLUA itens com quantidades IGUAIS
       - EXCLUA cabos com diferença 0.0
    
    4. **FORMATO OBRIGATÓRIO:**
    
    🚨 DIVERGÊNCIAS ENCONTRADAS:
    
    🔌 CABOS UNIPOLARES:
    
    BITOLA: [1.5 mm² / 2.5 mm² / 4 mm² / 16 mm²]
    TOTAL LISTA: [soma CORRETA da bitola] m
    ORÇAMENTO: [quantidade] m
    DIFERENÇA: [+/- valor]
    STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]
    CORES INDIVIDUAIS: [lista com cores e quantidades]
    
    🔌 CABOS MULTICONDUCTORES:
    
    ITEM: [Nome completo]
    LISTA DE MATERIAIS: [quantidade] [unidade]
    ORÇAMENTO: [quantidade] [unidade]
    DIFERENÇA: [+/- valor]
    STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]
    
    ⚡ OUTROS MATERIAIS:
    
    ITEM: [Nome completo]
    LISTA DE MATERIAIS: [quantidade] [unidade]
    ORÇAMENTO: [quantidade] [unidade]
    DIFERENÇA: [+/- valor]
    STATUS: [QUANTIDADE DIFERENTE / FALTANDO NO ORÇAMENTO / EXTRA NO ORÇAMENTO]
    
    📊 RESUMO ESTATÍSTICO:
    - Total de divergências: [número]
    - Cabos unipolares problemáticos: [número]
    - Cabos multipolares problemáticos: [número]
    - Outros materiais problemáticos: [número]
    
    EXEMPLOS CORRETOS:
    
    🔌 CABOS UNIPOLARES:
    
    BITOLA: 2.5 mm²
    TOTAL LISTA: 4705.05 m  (soma APENAS dos cabos 2.5mm²)
    ORÇAMENTO: 4905.4 m
    DIFERENÇA: +200.35
    STATUS: QUANTIDADE DIFERENTE
    CORES INDIVIDUAIS: Amarelo (1666.9m), Azul claro (1123.04m), Branco (353.55m), Preto (267.82m), Verde-amarelo (1208.71m), Vermelho (285.4m)
    
    BITOLA: 16 mm²
    TOTAL LISTA: 245.5 m
    ORÇAMENTO: NÃO ENCONTRADO
    DIFERENÇA: -245.5
    STATUS: FALTANDO NO ORÇAMENTO
    CORES INDIVIDUAIS: Azul (51.2m), Branco (51.2m), Preto (51.2m), Verde (51.2m), Vermelho (40.7m)
    
    🔌 CABOS MULTICONDUCTORES:
    
    ITEM: CABO ISOLADO PP 3 X 1,5 MM2
    LISTA DE MATERIAIS: 322.7 m
    ORÇAMENTO: 322.7 m
    DIFERENÇA: 0.0
    STATUS: QUANTIDADE IGUAL → NÃO INCLUIR
    
    ITEM: CABO ISOLADO PP 3 X 1,5 MM2
    LISTA DE MATERIAIS: 322.7 m
    ORÇAMENTO: NÃO ENCONTRADO
    DIFERENÇA: -322.7
    STATUS: FALTANDO NO ORÇAMENTO
    
    REGRAS FINAIS CRÍTICAS:
    
    1. **SOMA CORRETA**: Some APENAS cabos da MESMA BITOLA
    2. **BITOLAS SEPARADAS**: 1.5mm², 2.5mm², 4mm², 16mm² são BITOLAS DIFERENTES
    3. **APENAS DIVERGÊNCIAS**: Exclua itens com quantidades iguais
    4. **CORRESPONDÊNCIA PRECISA**: Busque nomes similares nos dois documentos
    5. **CONVERSAO UNIDADE**: "pç" → "un"
    6. **FORMATO EXATO**: Mantenha a estrutura especificada
    
    VERIFIQUE:
    - Cabos 2.5mm²: Some APENAS linhas com "2.5 mm²"
    - Cabos 4mm²: Some APENAS linhas com "4 mm²" 
    - Cabos 1.5mm²: Procure correspondência multipolar
    - Exclua itens com diferença 0.0
    
    COMEÇE A ANÁLISE DETALHADA E MOSTRE APENAS DIVERGÊNCIAS:`;
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
