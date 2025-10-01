// script.js - Versão Simplificada (Apenas Divergentes)
class SmartComparator {
    constructor() {
        this.pdfFile = null;
        this.excelFile = null;
        this.pdfText = '';
        this.excelData = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeFiles());
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
                this.excelData = await this.extractExcelData(file);
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
            fullText += pageText + '\n';
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

    async analyzeFiles() {
        this.showLoading(true);
        
        try {
            console.log('🔍 Analisando arquivos...');
            
            // Extrai itens do PDF
            const pdfItems = this.extractItemsFromPDF(this.pdfText);
            console.log('📄 Itens do PDF:', pdfItems.length);
            
            // Extrai itens do Excel
            const excelItems = this.extractItemsFromExcel(this.excelData);
            console.log('📊 Itens do Excel:', excelItems.length);
            
            // Encontra divergências
            const divergentes = this.findDivergences(pdfItems, excelItems);
            
            // Mostra resultados
            this.displayDivergences(divergentes);
            
        } catch (error) {
            console.error('❌ Erro na análise:', error);
            alert('Erro na análise: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    extractItemsFromPDF(pdfText) {
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
                    items.push({ 
                        description: cleanDesc, 
                        quantity: cleanQty, 
                        unit: cleanUnit 
                    });
                }
            }
        });

        return items;
    }

    extractItemsFromExcel(excelData) {
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

    findDivergences(pdfItems, excelItems) {
        const divergentes = [];
        const matchedExcelIndices = new Set();

        // Para cada item do PDF, busca correspondente no Excel
        pdfItems.forEach(pdfItem => {
            let bestMatch = null;
            let bestSimilarity = 0;

            excelItems.forEach((excelItem, excelIndex) => {
                const similarity = this.calculateSimilarity(pdfItem.description, excelItem.description);
                
                if (similarity > bestSimilarity && similarity > 0.6) {
                    bestSimilarity = similarity;
                    bestMatch = { item: excelItem, index: excelIndex };
                }
            });

            if (bestMatch) {
                matchedExcelIndices.add(bestMatch.index);
                const excelItem = bestMatch.item;
                
                // Verifica se há divergência (mais de 2% de diferença)
                const quantityDiff = Math.abs(pdfItem.quantity - excelItem.quantity);
                const tolerance = pdfItem.quantity * 0.02;
                
                if (quantityDiff > tolerance) {
                    divergentes.push({
                        item: pdfItem.description,
                        lista_quantidade: pdfItem.quantity,
                        orcamento_quantidade: excelItem.quantity,
                        unidade: pdfItem.unit,
                        diferenca: excelItem.quantity - pdfItem.quantity,
                        similaridade: bestSimilarity
                    });
                }
            } else {
                // Item do PDF não encontrado no Excel
                divergentes.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: 0,
                    unidade: pdfItem.unit,
                    diferenca: -pdfItem.quantity,
                    similaridade: 0,
                    observacao: 'ITEM NÃO ENCONTRADO NO ORÇAMENTO'
                });
            }
        });

        // Itens do Excel que não foram encontrados no PDF
        excelItems.forEach((excelItem, index) => {
            if (!matchedExcelIndices.has(index)) {
                divergentes.push({
                    item: excelItem.description,
                    lista_quantidade: 0,
                    orcamento_quantidade: excelItem.quantity,
                    unidade: excelItem.unit,
                    diferenca: excelItem.quantity,
                    similaridade: 0,
                    observacao: 'ITEM EXTRA NO ORÇAMENTO'
                });
            }
        });

        return divergentes;
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

    displayDivergences(divergentes) {
        const resultsSection = document.getElementById('resultsSection');
        
        if (divergentes.length === 0) {
            resultsSection.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 20px; border-radius: 10px; text-align: center;">
                    <h3>🎉 NENHUMA DIVERGÊNCIA ENCONTRADA!</h3>
                    <p>Todos os itens estão corretos entre a lista e o orçamento.</p>
                </div>
            `;
        } else {
            let resultsHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h3>⚠️ ${divergentes.length} DIVERGÊNCIAS ENCONTRADAS</h3>
                    <p>Itens que precisam de atenção entre a lista e o orçamento:</p>
                </div>

                <div class="table-container">
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <thead>
                            <tr style="background: #dc3545; color: white;">
                                <th style="padding: 12px; text-align: left; width: 50%;">Item</th>
                                <th style="padding: 12px; text-align: center; width: 80px;">Unid.</th>
                                <th style="padding: 12px; text-align: center; width: 100px;">Lista</th>
                                <th style="padding: 12px; text-align: center; width: 100px;">Orçamento</th>
                                <th style="padding: 12px; text-align: center; width: 100px;">Diferença</th>
                                <th style="padding: 12px; text-align: left;">Observação</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            divergentes.forEach(item => {
                const differenceClass = item.diferenca > 0 ? 'style="color: #28a745; font-weight: bold;"' : 
                                      item.diferenca < 0 ? 'style="color: #dc3545; font-weight: bold;"' : '';
                
                const differenceText = item.diferenca > 0 ? `+${item.diferenca}` : item.diferenca;
                
                resultsHTML += `
                    <tr style="border-bottom: 1px solid #dee2e6;">
                        <td style="padding: 10px;">${item.item}</td>
                        <td style="padding: 10px; text-align: center;">${item.unidade}</td>
                        <td style="padding: 10px; text-align: center;">${item.lista_quantidade}</td>
                        <td style="padding: 10px; text-align: center;">${item.orcamento_quantidade}</td>
                        <td style="padding: 10px; text-align: center;" ${differenceClass}>${differenceText}</td>
                        <td style="padding: 10px;">${item.observacao || `Similaridade: ${(item.similaridade * 100).toFixed(0)}%`}</td>
                    </tr>
                `;
            });

            resultsHTML += `
                        </tbody>
                    </table>
                </div>
            `;
            
            resultsSection.innerHTML = resultsHTML;
        }

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
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

    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    new SmartComparator();
    console.log('✅ Sistema simplificado inicializado!');
});
