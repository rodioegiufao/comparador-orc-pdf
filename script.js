// script.js - Sistema Completo Corrigido
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelData = null;
        this.results = null;
        this.pdfItems = [];
        this.excelItems = [];
    }

    init() {
        this.bindEvents();
        this.defineGlobalFunctions();
    }

    defineGlobalFunctions() {
        // Define todas as funções globais
        window.copyToClipboard = (elementId) => {
            const textarea = document.getElementById(elementId);
            textarea.select();
            document.execCommand('copy');
            alert('✅ Prompt copiado para a área de transferência!');
        };

        window.processGPTResponse = () => {
            const responseText = document.getElementById('chatgptResponse').value;
            if (!responseText.trim()) {
                alert('Por favor, cole a resposta do ChatGPT primeiro.');
                return;
            }
        
            try {
                console.log('Resposta recebida:', responseText.substring(0, 500) + '...');
                
                // Tenta diferentes métodos de parsing
                const resultData = this.parseChatGPTResponse(responseText);
                this.displayResults(resultData);
                
            } catch (error) {
                console.error('Erro ao processar resposta:', error);
                
                alert('❌ Não consegui processar a resposta.\n\n' +
                      'Vou tentar a análise automática como alternativa...');
                
                // Fallback para análise automática
                this.runAutomaticAnalysis();
            }
        };
        
        // Novo método para parse flexível
        parseChatGPTResponse(responseText) {
            // Método 1: Tenta encontrar JSON
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const cleanedJson = jsonMatch[0]
                        .replace(/[\u2018\u2019]/g, "'")
                        .replace(/[\u201C\u201D]/g, '"')
                        .replace(/[“”]/g, '"')
                        .replace(/```json/g, '')
                        .replace(/```/g, '')
                        .trim();
                    
                    return JSON.parse(cleanedJson);
                } catch (e) {
                    console.log('JSON parse falhou, tentando método de tabela...');
                }
            }
        
            // Método 2: Parse por formato de tabela/texto
            return this.parseTableResponse(responseText);
        }
        
        // Método para parse de formato de tabela
        parseTableResponse(text) {
            const lines = text.split('\n').filter(line => line.trim());
            const comparison = [];
            
            let corretos = 0;
            let divergentes = 0;
            let faltandoOrcamento = 0;
            let faltandoLista = 0;
            
            lines.forEach(line => {
                line = line.trim();
                
                // Detecta itens por padrões comuns
                if (line.includes('✅') || line.includes('❌') || line.includes('⚠️') || line.includes('📋')) {
                    const statusMatch = line.match(/(✅|❌|⚠️|📋)/);
                    if (!statusMatch) return;
                    
                    const statusIcon = statusMatch[1];
                    const status = statusIcon === '✅' ? 'CORRETO' : 
                                  statusIcon === '❌' ? 'DIVERGENTE' : 
                                  statusIcon === '⚠️' ? 'FALTANDO_NO_ORCAMENTO' : 'FALTANDO_NA_LISTA';
                    
                    // Extrai quantidades
                    const qtdMatch = line.match(/(\d+[.,]?\d*)/g);
                    let listaQtd = null;
                    let orcamentoQtd = null;
                    
                    if (qtdMatch && qtdMatch.length >= 2) {
                        listaQtd = parseFloat(qtdMatch[0].replace(',', '.'));
                        orcamentoQtd = parseFloat(qtdMatch[1].replace(',', '.'));
                    } else if (qtdMatch && qtdMatch.length === 1) {
                        if (status === 'FALTANDO_NO_ORCAMENTO') {
                            listaQtd = parseFloat(qtdMatch[0].replace(',', '.'));
                        } else if (status === 'FALTANDO_NA_LISTA') {
                            orcamentoQtd = parseFloat(qtdMatch[0].replace(',', '.'));
                        }
                    }
                    
                    // Extrai descrição (remove status e quantidades)
                    let description = line
                        .replace(/(✅|❌|⚠️|📋)/g, '')
                        .replace(/\d+[.,]?\d*/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    if (description) {
                        comparison.push({
                            item: description,
                            lista_quantidade: listaQtd,
                            orcamento_quantidade: orcamentoQtd,
                            unidade: 'un',
                            status: status,
                            diferenca: orcamentoQtd !== null && listaQtd !== null ? orcamentoQtd - listaQtd : 
                                      status === 'FALTANDO_NO_ORCAMENTO' ? -listaQtd : orcamentoQtd,
                            observacao: `Analisado via ChatGPT - ${status}`
                        });
                        
                        // Conta estatísticas
                        if (status === 'CORRETO') corretos++;
                        else if (status === 'DIVERGENTE') divergentes++;
                        else if (status === 'FALTANDO_NO_ORCAMENTO') faltandoOrcamento++;
                        else if (status === 'FALTANDO_NA_LISTA') faltandoLista++;
                    }
                }
            });
            
            const totalPDF = corretos + divergentes + faltandoOrcamento;
            const totalExcel = corretos + divergentes + faltandoLista;
            const taxaAcerto = totalPDF > 0 ? ((corretos / totalPDF) * 100).toFixed(1) + '%' : '0%';
            
            return {
                resumo: {
                    total_itens_pdf: totalPDF,
                    total_itens_excel: totalExcel,
                    itens_corretos: corretos,
                    itens_divergentes: divergentes,
                    itens_faltando_orcamento: faltandoOrcamento,
                    itens_faltando_lista: faltandoLista,
                    taxa_acerto: taxaAcerto
                },
                comparacao: comparison,
                recomendacoes: [
                    `Ajustar ${divergentes} itens divergentes`,
                    `Incluir ${faltandoOrcamento} itens faltantes no orçamento`,
                    `Verificar ${faltandoLista} itens extras no Excel`
                ]
            };
        }
            
            const totalPDF = corretos + divergentes + faltandoOrcamento;
            const totalExcel = corretos + divergentes + faltandoLista;
            const taxaAcerto = totalPDF > 0 ? ((corretos / totalPDF) * 100).toFixed(1) + '%' : '0%';
            
            return {
                resumo: {
                    total_itens_pdf: totalPDF,
                    total_itens_excel: totalExcel,
                    itens_corretos: corretos,
                    itens_divergentes: divergentes,
                    itens_faltando_orcamento: faltandoOrcamento,
                    itens_faltando_lista: faltandoLista,
                    taxa_acerto: taxaAcerto
                },
                comparacao: comparison,
                recomendacoes: [
                    `Ajustar ${divergentes} itens divergentes`,
                    `Incluir ${faltandoOrcamento} itens faltantes no orçamento`,
                    `Verificar ${faltandoLista} itens extras no Excel`
                ]
            };
        }

        window.runAutomaticAnalysis = () => {
            if (!window.smartComparator) {
                alert('Sistema não inicializado.');
                return;
            }
            window.smartComparator.runAutomaticAnalysis();
        };

        window.testWithCompleteMockData = () => {
            const mockData = {
                "resumo": {
                    "total_itens_pdf": 85,
                    "total_itens_excel": 73,
                    "itens_corretos": 45,
                    "itens_divergentes": 28,
                    "itens_faltando_orcamento": 12,
                    "itens_faltando_lista": 5,
                    "taxa_acerto": "52.9%"
                },
                "comparacao": [
                    {
                        "item": "CABO ISOLADO PP 3 X 1,5 MM2",
                        "lista_quantidade": 312.4,
                        "orcamento_quantidade": 312.4,
                        "unidade": "m",
                        "status": "CORRETO",
                        "diferenca": 0,
                        "observacao": "Quantidades coincidem perfeitamente"
                    },
                    {
                        "item": "ELETRODUTO FLEXÍVEL CORRUGADO, 3/4\", INSTALADO NO PISO",
                        "lista_quantidade": 82.9,
                        "orcamento_quantidade": 82.9,
                        "unidade": "m",
                        "status": "CORRETO", 
                        "diferenca": 0,
                        "observacao": "Quantidades coincidem"
                    },
                    {
                        "item": "CAIXA DE PASSAGEM PVC 4X2\"",
                        "lista_quantidade": 21,
                        "orcamento_quantidade": 20,
                        "unidade": "un",
                        "status": "DIVERGENTE",
                        "diferenca": -1,
                        "observacao": "PDF: 21 un vs Excel: 20 un"
                    },
                    {
                        "item": "PLUGUE FÊMEA LUMINARIA LED",
                        "lista_quantidade": 268,
                        "orcamento_quantidade": null,
                        "unidade": "un", 
                        "status": "FALTANDO_NO_ORCAMENTO",
                        "diferenca": -268,
                        "observacao": "Item não encontrado no orçamento"
                    },
                    {
                        "item": "ITEM EXTRA NO EXCEL",
                        "lista_quantidade": null,
                        "orcamento_quantidade": 50,
                        "unidade": "un",
                        "status": "FALTANDO_NA_LISTA", 
                        "diferenca": 50,
                        "observacao": "Item extra no orçamento"
                    }
                ],
                "recomendacoes": [
                    "Ajustar 28 itens com quantidades divergentes",
                    "Incluir 12 itens faltantes no orçamento", 
                    "Verificar 5 itens extras no Excel",
                    "Realizar revisão final antes da aprovação"
                ]
            };
            
            // Adiciona mais itens mock
            for (let i = 6; i <= 30; i++) {
                const statuses = ['CORRETO', 'DIVERGENTE', 'FALTANDO_NO_ORCAMENTO', 'FALTANDO_NA_LISTA'];
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                
                mockData.comparacao.push({
                    "item": `ITEM EXEMPLO ${i} - MATERIAL ELÉTRICO`,
                    "lista_quantidade": status !== 'FALTANDO_NA_LISTA' ? Math.random() * 100 : null,
                    "orcamento_quantidade": status !== 'FALTANDO_NO_ORCAMENTO' ? Math.random() * 100 : null,
                    "unidade": "un",
                    "status": status,
                    "diferenca": 0,
                    "observacao": `Item de exemplo ${i} - Status: ${status}`
                });
            }
            
            this.displayResults(mockData);
            alert('✅ Teste com dados completos! ' + mockData.comparacao.length + ' itens carregados.');
        };

        // Funções de filtro
        window.filterTable = (filter) => {
            const rows = document.querySelectorAll('#comparisonTable tbody tr');
            const buttons = document.querySelectorAll('.filter-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            rows.forEach(row => {
                const status = row.getAttribute('data-status');
                let show = false;
                
                switch(filter) {
                    case 'all': show = true; break;
                    case 'CORRETO': show = status === 'CORRETO'; break;
                    case 'DIVERGENTE': show = status === 'DIVERGENTE'; break;
                    case 'FALTANDO': show = status.includes('FALTANDO'); break;
                }
                
                row.style.display = show ? '' : 'none';
            });
        };

        // Funções de exportação
        window.exportToExcel = () => {
            if (!window.smartComparator || !window.smartComparator.results) {
                alert('Nenhum resultado para exportar.');
                return;
            }
            
            const results = window.smartComparator.results;
            
            // Cria workbook
            const wb = XLSX.utils.book_new();
            
            // Sheet de resumo
            const summaryData = [
                ['RELATÓRIO DE ANÁLISE DE COMPATIBILIDADE'],
                ['Data:', new Date().toLocaleDateString()],
                [],
                ['RESUMO'],
                ['Itens na Lista (PDF):', results.resumo.total_itens_pdf],
                ['Itens no Orçamento (Excel):', results.resumo.total_itens_excel],
                ['Itens Corretos:', results.resumo.itens_corretos],
                ['Itens Divergentes:', results.resumo.itens_divergentes],
                ['Itens Faltantes no Orçamento:', results.resumo.itens_faltando_orcamento],
                ['Itens Faltantes na Lista:', results.resumo.itens_faltando_lista],
                ['Taxa de Acerto:', results.resumo.taxa_acerto],
                [],
                ['RECOMENDAÇÕES'],
                ...results.recomendacoes.map(rec => [rec])
            ];
            
            const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, ws_summary, "Resumo");
            
            // Sheet de comparação detalhada
            const comparisonData = [
                ['Status', 'Item', 'Unidade', 'Quantidade Lista', 'Quantidade Orçamento', 'Diferença', 'Observação']
            ];
            
            results.comparacao.forEach(item => {
                const status = item.status === 'CORRETO' ? 'CORRETO' : 
                              item.status === 'DIVERGENTE' ? 'DIVERGENTE' : 
                              item.status === 'FALTANDO_NO_ORCAMENTO' ? 'FALTANDO NO ORÇAMENTO' : 'FALTANDO NA LISTA';
                
                comparisonData.push([
                    status,
                    item.item,
                    item.unidade || '-',
                    item.lista_quantidade !== null && item.lista_quantidade !== undefined ? item.lista_quantidade : '-',
                    item.orcamento_quantidade !== null && item.orcamento_quantidade !== undefined ? item.orcamento_quantidade : '-',
                    item.diferenca !== null && item.diferenca !== undefined ? item.diferenca : '-',
                    item.observacao
                ]);
            });
            
            const ws_comparison = XLSX.utils.aoa_to_sheet(comparisonData);
            XLSX.utils.book_append_sheet(wb, ws_comparison, "Comparação Detalhada");
            
            // Exporta
            const fileName = 'relatorio_analise_' + new Date().getTime() + '.xlsx';
            XLSX.writeFile(wb, fileName);
            
            alert('✅ Relatório exportado para Excel: ' + fileName);
        };

        window.exportToJSON = () => {
            if (!window.smartComparator || !window.smartComparator.results) {
                alert('Nenhum resultado para exportar.');
                return;
            }
            
            const dataStr = JSON.stringify(window.smartComparator.results, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'analise_comparativa_' + new Date().getTime() + '.json';
            link.click();
        };

        window.showRawData = () => {
            if (!window.smartComparator || !window.smartComparator.results) {
                alert('Nenhum resultado disponível.');
                return;
            }
            
            console.log('📊 Dados completos:', window.smartComparator.results);
            alert('Dados completos disponíveis no console (F12 → Console)');
        };
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
                this.pdfItems = this.extractPDFItems(this.pdfText);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - ' + this.pdfItems.length + ' itens detectados</small>';
            } else {
                this.excelFile = file;
                this.excelData = await this.extractExcelData(file);
                this.excelItems = this.extractExcelItems(this.excelData);
                previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ✅</p><small>' + (file.size / 1024).toFixed(1) + ' KB - ' + this.excelItems.length + ' itens detectados</small>';
            }
        } catch (error) {
            console.error('Erro ao processar ' + type + ':', error);
            previewElement.innerHTML = '<p><strong>' + file.name + '</strong> ❌ Erro: ' + error.message + '</p>';
        } finally {
            this.checkFilesReady();
        }
    }

    extractPDFItems(pdfText) {
        const items = [];
        const lines = pdfText.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length < 5) return;

            // Padrão: descrição seguida de número e unidade
            const pattern = /(.+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm|mm2)/i;
            const match = trimmed.match(pattern);
            
            if (match) {
                const [, description, quantity, unit] = match;
                const cleanDesc = this.cleanDescription(description);
                const cleanQty = this.parseQuantity(quantity);
                const cleanUnit = this.normalizeUnit(unit);

                if (cleanDesc && cleanDesc.length > 3 && !isNaN(cleanQty) && cleanQty > 0) {
                    // Evita duplicatas
                    const existing = items.find(item => 
                        item.description === cleanDesc && item.quantity === cleanQty
                    );
                    
                    if (!existing) {
                        items.push({ 
                            description: cleanDesc, 
                            quantity: cleanQty, 
                            unit: cleanUnit 
                        });
                    }
                }
            }
        });

        return items;
    }

    extractExcelItems(excelData) {
        const items = [];
        
        excelData.sheetNames.forEach(sheetName => {
            const sheet = excelData.sheets[sheetName];
            sheet.forEach((row, index) => {
                // Colunas: D=Descrição, E=Unidade, F=Quantidade
                if (row && row.length >= 6 && row[3] && row[5] && !isNaN(parseFloat(row[5]))) {
                    const description = this.cleanDescription(row[3]);
                    const quantity = this.parseQuantity(row[5]);
                    const unit = this.normalizeUnit(row[4] || 'un');

                    if (description && description.length > 3 && !isNaN(quantity) && quantity > 0) {
                        items.push({ description, quantity, unit });
                    }
                }
            });
        });

        return items;
    }

    cleanDescription(desc) {
        if (typeof desc !== 'string') return '';
        return desc
            .replace(/^[-•*]\s*/, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*,\s*/g, ', ')
            .trim();
    }

    parseQuantity(qty) {
        if (typeof qty === 'number') return qty;
        if (typeof qty === 'string') {
            return parseFloat(qty.replace(',', '.')) || 0;
        }
        return 0;
    }

    normalizeUnit(unit) {
        if (!unit) return 'un';
        const unitMap = {
            'm': 'm', 'un': 'un', 'pç': 'pç', 'mm': 'mm',
            'metro': 'm', 'unidade': 'un', 'peça': 'pç',
            'mm2': 'mm²', 'mm²': 'mm²'
        };
        return unitMap[unit.toLowerCase()] || 'un';
    }

    async extractPDFText(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += '--- PÁGINA ' + i + ' ---\n' + pageText + '\n\n';
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
    }

    async analyzeWithChatGPT() {
        this.showLoading(true);
        
        try {
            console.log('Iniciando análise com ChatGPT...');
            
            const analysisData = {
                pdfText: this.optimizePDFText(this.pdfText),
                excelData: this.optimizeExcelData(this.excelData),
                pdfItemsCount: this.pdfItems.length,
                excelItemsCount: this.excelItems.length
            };

            const prompt = this.createAnalysisPrompt(analysisData);
            this.displayChatGPTPrompt(prompt);
            
        } catch (error) {
            console.error('Erro na análise:', error);
            alert('Erro na análise: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    optimizePDFText(pdfText) {
        return pdfText
            .split('\n')
            .filter(line => line.length > 10)
            .map(line => line.replace(/\s+/g, ' ').trim())
            .join('\n')
            .substring(0, 12000);
    }

    optimizeExcelData(excelData) {
        let excelText = 'ARQUIVO: ' + excelData.fileName + '\n';
        excelText += 'PLANILHAS: ' + excelData.sheetNames.join(', ') + '\n\n';
        
        excelData.sheetNames.forEach(sheetName => {
            const sheetData = excelData.sheets[sheetName];
            excelText += '=== PLANILHA: ' + sheetName + ' ===\n';
            
            sheetData.forEach((row, index) => {
                if (index > 0 && row && row.length >= 6) {
                    const descricao = row[3] || '';
                    const unidade = row[4] || '';
                    const quantidade = row[5] || '';
                    
                    if (descricao && quantidade && !isNaN(parseFloat(quantidade))) {
                        excelText += 'LINHA ' + (index + 1) + ': "' + descricao + '" | QTD: ' + quantidade + ' ' + unidade + '\n';
                    }
                }
            });
        });

        return excelText;
    }

    createAnalysisPrompt(data) {
        return `ANÁLISE COMPLETA DE COMPATIBILIDADE - LISTA DE MATERIAIS vs ORÇAMENTO

CONTEXTO CRÍTICO:
Você DEVE analisar TODOS os itens. Detectamos ${data.pdfItemsCount} itens no PDF e ${data.excelItemsCount} itens no Excel.

DADOS DO PDF (LISTA DE MATERIAIS):
"""
${data.pdfText}
"""

DADOS DO EXCEL (ORÇAMENTO):
"""
${data.excelData}
"""

INSTRUÇÕES ABSOLUTAS:

1. EXTRAIA TODOS OS ITENS do PDF. Formato típico: "DESCRIÇÃO QUANTIDADE UNIDADE"
2. IDENTIFIQUE TODOS OS ITENS correspondentes no Excel
3. ANALISE CADA ITEM INDIVIDUALMENTE
4. CLASSIFIQUE CORRETAMENTE:

   ✅ CORRETO: Quantidades iguais (±2% tolerância)
   ❌ DIVERGENTE: Quantidades diferentes (>2% diferença)  
   ⚠️ FALTANDO_NO_ORCAMENTO: Item do PDF AUSENTE no Excel
   📋 FALTANDO_NA_LISTA: Item do Excel AUSENTE no PDF

5. INCLUA PELO MENOS ${Math.max(data.pdfItemsCount, data.excelItemsCount)} ITENS na comparação

6. ESTRUTURA DO JSON:

{
  "resumo": {
    "total_itens_pdf": ${data.pdfItemsCount},
    "total_itens_excel": ${data.excelItemsCount},
    "itens_corretos": [número REAL],
    "itens_divergentes": [número REAL], 
    "itens_faltando_orcamento": [número REAL],
    "itens_faltando_lista": [número REAL],
    "taxa_acerto": "XX.X%"
  },
  "comparacao": [
    {
      "item": "DESCRIÇÃO COMPLETA",
      "lista_quantidade": [número ou null],
      "orcamento_quantidade": [número ou null], 
      "unidade": "un|m|pç",
      "status": "CORRETO|DIVERGENTE|FALTANDO_NO_ORCAMENTO|FALTANDO_NA_LISTA",
      "diferenca": [número],
      "observacao": "Detalhes específicos"
    }
    // ... INCLUA DEZENAS DE ITENS AQUI ...
  ],
  "recomendacoes": [
    "Ações baseadas na análise completa"
  ]
}

EXIGÊNCIAS:
- Analise ITENS SUFICIENTES para justificar os totais do resumo
- Para FALTANDO_NO_ORCAMENTO: lista_quantidade = número, orcamento_quantidade = null
- Para FALTANDO_NA_LISTA: lista_quantidade = null, orcamento_quantidade = número  
- Diferenca = orcamento_quantidade - lista_quantidade

FORMATO DA RESPOSTA (ESCOLHA UM):

OPÇÃO 1 - JSON (PREFERIDO):
{
  \"resumo\": { ... },
  \"comparacao\": [ ... ],
  \"recomendacoes\": [ ... ]
}

OPÇÃO 2 - TEXTO SIMPLES (ALTERNATIVA):
✅ CABO ISOLADO PP 3 X 1,5 MM2 - PDF: 312.4m Excel: 312.4m
❌ CAIXA PVC 4X2 - PDF: 21un Excel: 20un
⚠️ PLUGUE LED - PDF: 268un Excel: NÃO ENCONTRADO
📋 ITEM EXTRA - PDF: NÃO ENCONTRADO Excel: 50un

Retorne no formato que preferir, mas seja COMPLETO na análise.`;
    }

    displayChatGPTPrompt(prompt) {
        const resultsSection = document.getElementById('resultsSection');
        
        resultsSection.innerHTML = `
            <div class="prompt-section">
                <h3>🧠 Prompt para ChatGPT</h3>
                <textarea id="analysisPrompt" readonly style="height: 400px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">${prompt}</textarea>
                <button onclick="copyToClipboard('analysisPrompt')" class="copy-btn">📋 Copiar Prompt</button>
                
                <div class="instructions">
                    <p><strong>📋 Como usar (IMPORTANTE):</strong></p>
                    <ol>
                        <li>Copie TODO o prompt (Ctrl+A, Ctrl+C)</li>
                        <li>Cole no <strong>ChatGPT-4</strong></li>
                        <li>AGUARDE a análise COMPLETA (2-3 minutos)</li>
                        <li>Copie a resposta JSON INTEIRA</li>
                        <li>Cole abaixo e clique em "Processar Resposta"</li>
                    </ol>
                    <p><strong>📊 Dados detectados:</strong></p>
                    <ul>
                        <li>PDF: ${this.pdfItems.length} itens extraídos</li>
                        <li>Excel: ${this.excelItems.length} itens extraídos</li>
                    </ul>
                    <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px;">
                        <strong>💡 Dica:</strong> Se o ChatGPT não retornar análise completa, use o botão 
                        <strong>"🤖 Análise Automática"</strong> abaixo como alternativa.
                    </div>
                </div>
            </div>

            <div class="response-section">
                <h3>📝 Resposta do ChatGPT</h3>
                <textarea id="chatgptResponse" placeholder="Cole aqui a resposta JSON COMPLETA do ChatGPT..." style="height: 200px; font-family: monospace;"></textarea>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick="processGPTResponse()" class="process-btn">🔄 Processar Resposta</button>
                    <button onclick="runAutomaticAnalysis()" class="analyze-btn">🤖 Análise Automática</button>
                    <button onclick="testWithCompleteMockData()" class="details-btn">🧪 Teste Completo</button>
                </div>
            </div>
        `;

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // ANÁLISE AUTOMÁTICA como fallback
    runAutomaticAnalysis() {
        this.showLoading(true);
        
        setTimeout(() => {
            try {
                const results = this.performAutomaticAnalysis();
                this.displayResults(results);
                alert('✅ Análise automática concluída! ' + results.comparacao.length + ' itens analisados.');
            } catch (error) {
                alert('❌ Erro na análise automática: ' + error.message);
            } finally {
                this.showLoading(false);
            }
        }, 1000);
    }

    performAutomaticAnalysis() {
        const comparison = [];
        const matchedExcelIndices = new Set();

        // Para cada item do PDF, busca correspondente no Excel
        this.pdfItems.forEach(pdfItem => {
            let bestMatch = null;
            let bestSimilarity = 0;

            this.excelItems.forEach((excelItem, excelIndex) => {
                const similarity = this.calculateSimilarity(pdfItem.description, excelItem.description);
                
                if (similarity > bestSimilarity && similarity > 0.6) {
                    bestSimilarity = similarity;
                    bestMatch = { item: excelItem, index: excelIndex };
                }
            });

            if (bestMatch) {
                matchedExcelIndices.add(bestMatch.index);
                const excelItem = bestMatch.item;
                
                const quantityDiff = Math.abs(pdfItem.quantity - excelItem.quantity);
                const tolerance = pdfItem.quantity * 0.02; // 2% de tolerância
                
                const status = quantityDiff <= tolerance ? 'CORRETO' : 'DIVERGENTE';
                const difference = excelItem.quantity - pdfItem.quantity;

                let observacao = '';
                if (status === 'CORRETO') {
                    observacao = `Quantidades coincidem (${pdfItem.quantity} ${pdfItem.unit})`;
                } else {
                    observacao = `PDF: ${pdfItem.quantity} ${pdfItem.unit} vs Excel: ${excelItem.quantity} ${excelItem.unit} - Diferença: ${difference}`;
                }

                comparison.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: excelItem.quantity,
                    unidade: pdfItem.unit,
                    status: status,
                    diferenca: difference,
                    observacao: observacao + ` [Similaridade: ${(bestSimilarity * 100).toFixed(0)}%]`
                });
            } else {
                // Item do PDF não encontrado no Excel
                comparison.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: null,
                    unidade: pdfItem.unit,
                    status: 'FALTANDO_NO_ORCAMENTO',
                    diferenca: -pdfItem.quantity,
                    observacao: 'Item não encontrado no orçamento'
                });
            }
        });

        // Itens do Excel que não foram encontrados no PDF
        this.excelItems.forEach((excelItem, index) => {
            if (!matchedExcelIndices.has(index)) {
                comparison.push({
                    item: excelItem.description,
                    lista_quantidade: null,
                    orcamento_quantidade: excelItem.quantity,
                    unidade: excelItem.unit,
                    status: 'FALTANDO_NA_LISTA',
                    diferenca: excelItem.quantity,
                    observacao: 'Item extra no orçamento (não está na lista)'
                });
            }
        });

        const corretos = comparison.filter(item => item.status === 'CORRETO').length;
        const divergentes = comparison.filter(item => item.status === 'DIVERGENTE').length;
        const faltandoOrcamento = comparison.filter(item => item.status === 'FALTANDO_NO_ORCAMENTO').length;
        const faltandoLista = comparison.filter(item => item.status === 'FALTANDO_NA_LISTA').length;
        const taxaAcerto = ((corretos / this.pdfItems.length) * 100).toFixed(1) + '%';

        return {
            resumo: {
                total_itens_pdf: this.pdfItems.length,
                total_itens_excel: this.excelItems.length,
                itens_corretos: corretos,
                itens_divergentes: divergentes,
                itens_faltando_orcamento: faltandoOrcamento,
                itens_faltando_lista: faltandoLista,
                taxa_acerto: taxaAcerto
            },
            comparacao: comparison,
            recomendacoes: [
                `Ajustar ${divergentes} itens com quantidades divergentes`,
                `Incluir ${faltandoOrcamento} itens faltantes no orçamento`,
                `Verificar ${faltandoLista} itens extras no Excel`,
                'Revisar todas as quantidades antes da aprovação'
            ]
        };
    }

    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);

        if (s1 === s2) return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) return 0.9;

        const words1 = s1.split(/\s+/).filter(w => w.length > 2);
        const words2 = s2.split(/\s+/).filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return 0;

        const commonWords = words1.filter(word => 
            words2.some(w2 => w2.includes(word) || word.includes(w2))
        );

        return commonWords.length / Math.max(words1.length, words2.length);
    }

    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    displayResults(resultData) {
        this.results = resultData;
        const resultsSection = document.getElementById('resultsSection');
        
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
                <h3>📋 Relatório de Análise</h3>
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
                        <strong>Itens Analisados:</strong> ${resultData.comparacao.length}
                    </div>
                </div>
            </div>

            <div class="filters">
                <button class="filter-btn active" onclick="filterTable('all')">Todos</button>
                <button class="filter-btn" onclick="filterTable('CORRETO')">✅ Corretos</button>
                <button class="filter-btn" onclick="filterTable('DIVERGENTE')">❌ Divergentes</button>
                <button class="filter-btn" onclick="filterTable('FALTANDO')">⚠️ Faltantes</button>
            </div>

            <div class="table-container">
                <table id="comparisonTable">
                    <thead>
                        <tr>
                            <th width="50">Status</th>
                            <th width="250">Item</th>
                            <th width="60">Unid.</th>
                            <th width="80">Lista</th>
                            <th width="80">Orçamento</th>
                            <th width="80">Diferença</th>
                            <th>Observação</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        resultData.comparacao.forEach(function(item, index) {
            const statusIcon = item.status === 'CORRETO' ? '✅' : 
                              item.status === 'DIVERGENTE' ? '❌' : 
                              item.status === 'FALTANDO_NO_ORCAMENTO' ? '⚠️' : '📋';
            
            const differenceClass = item.diferenca > 0 ? 'difference-positive' : 
                                  item.diferenca < 0 ? 'difference-negative' : '';

            resultsHTML += `
                <tr data-status="${item.status}" data-index="${index}">
                    <td>${statusIcon}</td>
                    <td title="${item.item}">${item.item.length > 60 ? item.item.substring(0, 60) + '...' : item.item}</td>
                    <td>${item.unidade || '-'}</td>
                    <td>${item.lista_quantidade !== null && item.lista_quantidade !== undefined ? item.lista_quantidade : '-'}</td>
                    <td>${item.orcamento_quantidade !== null && item.orcamento_quantidade !== undefined ? item.orcamento_quantidade : '-'}</td>
                    <td class="${differenceClass}">${item.diferenca > 0 ? '+' : ''}${item.diferenca !== null && item.diferenca !== undefined ? item.diferenca : '-'}</td>
                    <td>${item.observacao}</td>
                </tr>
            `;
        });

        resultsHTML += `
                </tbody>
            </table>
        </div>

        <div class="recommendations">
            <h3>💡 Recomendações</h3>
            <ul>
                ${resultData.recomendacoes.map(function(rec) { return '<li>' + rec + '</li>'; }).join('')}
            </ul>
        </div>

        <div class="export-section">
            <button onclick="exportToExcel()" class="export-btn">📊 Exportar para Excel</button>
            <button onclick="exportToJSON()" class="details-btn">📁 Exportar JSON</button>
            <button onclick="showRawData()" class="details-btn">🔍 Ver Dados Completos</button>
        </div>
    `;

    resultsSection.innerHTML = resultsHTML;
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    window.smartComparator = new SmartComparator();
    window.smartComparator.init();
    console.log('✅ Sistema com funções globais corrigidas!');
});
