// script.js - Versão com análise real dos arquivos
class MaterialComparator {
    constructor() {
        this.pdfData = [];
        this.excelData = [];
        this.results = [];
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
        document.getElementById('compareBtn').addEventListener('click', () => this.compareFiles());
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterTable(e.target.dataset.filter));
        });
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToExcel());
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const previewElement = document.getElementById(`${type}Preview`);
        const infoElement = document.getElementById(`${type}Info`);
        
        previewElement.innerHTML = `<p><strong>${file.name}</strong></p>`;
        infoElement.textContent = `Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB`;

        if (type === 'pdf') {
            this.pdfFile = file;
            this.pdfData = await this.parsePDF(file);
            infoElement.textContent += ` | Itens detectados: ${this.pdfData.length}`;
        } else {
            this.excelFile = file;
            this.excelData = await this.parseExcel(file);
            infoElement.textContent += ` | Itens detectados: ${this.excelData.length}`;
        }

        this.checkFilesReady();
    }

    // ==================== PARSER DE PDF ====================
    async parsePDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            // Extrai texto de todas as páginas
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            return this.parseMaterialsFromPDFText(fullText);
        } catch (error) {
            console.error('Erro ao parsear PDF:', error);
            throw new Error('Falha ao ler o arquivo PDF');
        }
    }

    parseMaterialsFromPDFText(text) {
        const materials = [];
        const lines = text.split('\n');
        
        let currentSection = null;
        let inMaterialsSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detecta seções principais
            if (line.includes('Lista de materiais') || line.includes('COMPOSIÇÃO') || line.includes('SINAPI')) {
                inMaterialsSection = true;
                continue;
            }

            if (line.includes('METROS')) {
                currentSection = 'meters';
                continue;
            }

            if (line.includes('UNIDADES')) {
                currentSection = 'units';
                continue;
            }

            if (!inMaterialsSection || !line || this.isHeaderLine(line)) {
                continue;
            }

            // Tenta parsear a linha como item de material
            const material = this.parseMaterialLine(line, currentSection);
            if (material) {
                materials.push(material);
                
                // Verifica se as próximas linhas são continuação da descrição
                let j = i + 1;
                while (j < lines.length && this.isDescriptionContinuation(lines[j])) {
                    material.description += ' ' + lines[j].trim();
                    j++;
                    i++; // Avança o índice principal
                }
            }
        }

        return materials;
    }

    parseMaterialLine(line, section) {
        // Padrões para detectar materiais com quantidades
        const patterns = [
            // Padrão: "DESCRIÇÃO 123.45 m" ou "DESCRIÇÃO 123 un"
            /^([A-Z][^0-9\n]+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm|"|″|polegada)/i,
            
            // Padrão: "- DESCRIÇÃO 123.45 m"
            /^[-•*]\s*([^0-9\n]+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm)/i,
            
            // Padrão: "123.45 m DESCRIÇÃO"
            /^(\d+[.,]\d+|\d+)\s*(m|un|pç)\s+([^0-9\n]+)/i,
            
            // Padrão para cabos: "CABO XXX X.X MM2 123.45 m"
            /^(CABO[^0-9\n]+?)\s+(\d+[.,]\d+|\d+)\s*m/i,
            
            // Padrão para tomadas/componentes: "TOMADA XXX 123 un"
            /^([A-Z][^0-9\n]+?)\s+(\d+)\s*(un|pç)/i
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                let description, quantity, unit;

                if (pattern === patterns[2]) {
                    // Padrão invertido: "123.45 m DESCRIÇÃO"
                    [, quantity, unit, description] = match;
                } else {
                    // Padrões normais: "DESCRIÇÃO 123.45 m"
                    [, description, quantity, unit] = match;
                }

                return {
                    description: this.cleanDescription(description),
                    quantity: this.parseQuantity(quantity),
                    unit: this.normalizeUnit(unit || this.inferUnit(section)),
                    rawLine: line
                };
            }
        }

        return null;
    }

    cleanDescription(desc) {
        return desc
            .replace(/^[-•*]\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    parseQuantity(qtyStr) {
        return parseFloat(qtyStr.replace(',', '.'));
    }

    normalizeUnit(unit) {
        if (!unit) return 'un';
        
        const unitMap = {
            'm': 'm', 'metro': 'm', 'metros': 'm',
            'un': 'un', 'unid': 'un', 'unidade': 'un', 'unidades': 'un',
            'pç': 'pç', 'pc': 'pç', 'peça': 'pç', 'peças': 'pç',
            'mm': 'mm', 'milimetro': 'mm', '"': 'polegada', '″': 'polegada'
        };
        
        const normalized = unit.toLowerCase();
        return unitMap[normalized] || normalized;
    }

    inferUnit(section) {
        return section === 'meters' ? 'm' : 'un';
    }

    isHeaderLine(line) {
        return /^(DESCRIÇÃO|ITEM|QUANTIDADE|UNIDADE|===|---)/i.test(line);
    }

    isDescriptionContinuation(line) {
        const trimmed = line.trim();
        return trimmed && 
               !this.isHeaderLine(trimmed) && 
               !this.parseMaterialLine(trimmed) &&
               !/^[\d.,]+\s*(m|un|pç)/i.test(trimmed); // Não começa com quantidade
    }

    // ==================== PARSER DE EXCEL ====================
    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    
                    const materials = this.parseExcelData(jsonData);
                    resolve(materials);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Erro ao ler arquivo Excel'));
            reader.readAsArrayBuffer(file);
        });
    }

    parseExcelData(jsonData) {
        const materials = [];
        
        // Encontra a linha de cabeçalho
        const headerRowIndex = this.findHeaderRow(jsonData);
        if (headerRowIndex === -1) return materials;

        const headers = jsonData[headerRowIndex].map(h => this.normalizeHeader(h));
        const colMap = this.mapExcelColumns(headers);
        
        // Processa linhas de dados
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const material = this.parseExcelRow(row, colMap);
            if (material) {
                materials.push(material);
            }
        }

        return materials;
    }

    findHeaderRow(data) {
        const headerKeywords = ['descrição', 'item', 'material', 'quantidade', 'qtd', 'unidade', 'und'];
        
        for (let i = 0; i < Math.min(15, data.length); i++) {
            const row = data[i] || [];
            const rowText = row.join(' ').toLowerCase();
            
            const matchCount = headerKeywords.filter(keyword => 
                rowText.includes(keyword)
            ).length;
            
            if (matchCount >= 2) {
                return i;
            }
        }
        
        return 0;
    }

    normalizeHeader(header) {
        return String(header || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    mapExcelColumns(headers) {
        const mapping = {};
        
        headers.forEach((header, index) => {
            if (header.includes('descricao') || header.includes('item') || header.includes('material')) {
                mapping.description = index;
            } else if (header.includes('quantidade') || header.includes('qtd')) {
                mapping.quantity = index;
            } else if (header.includes('unidade') || header.includes('und')) {
                mapping.unit = index;
            }
        });

        return mapping;
    }

    parseExcelRow(row, colMap) {
        const description = row[colMap.description];
        let quantity = row[colMap.quantity];
        const unit = row[colMap.unit];

        if (!description || quantity === undefined || quantity === null) {
            return null;
        }

        // Converte quantidade para número
        if (typeof quantity === 'string') {
            quantity = parseFloat(quantity.replace(',', '.')) || 0;
        }

        return {
            description: String(description).trim(),
            quantity: quantity,
            unit: this.normalizeExcelUnit(unit),
            rawData: row
        };
    }

    normalizeExcelUnit(unit) {
        if (!unit) return 'un';
        
        const unitStr = String(unit).toLowerCase();
        const unitMap = {
            'm': 'm', 'mt': 'm', 'metro': 'm',
            'un': 'un', 'unid': 'un', 'und': 'un',
            'pç': 'pç', 'pc': 'pç', 'cx': 'cx'
        };
        
        return unitMap[unitStr] || unitStr;
    }

    // ==================== COMPARAÇÃO INTELIGENTE ====================
    async compareFiles() {
        this.showLoading(true);
        
        try {
            if (!this.pdfData.length || !this.excelData.length) {
                throw new Error('Nenhum item detectado nos arquivos. Verifique o formato.');
            }

            this.results = await this.compareMaterials(this.pdfData, this.excelData);
            this.displayResults();
            
        } catch (error) {
            console.error('Erro na comparação:', error);
            alert('Erro: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async compareMaterials(pdfItems, excelItems) {
        const results = [];
        const matchedExcelIndices = new Set();

        // Para cada item do PDF, busca o melhor match no Excel
        pdfItems.forEach(pdfItem => {
            const { bestMatch, similarity } = this.findBestMatch(pdfItem, excelItems);
            
            if (bestMatch && similarity >= 0.3) { // Threshold baixo para capturar mais matches
                matchedExcelIndices.add(bestMatch.index);
                
                const quantityMatch = Math.abs(pdfItem.quantity - bestMatch.item.quantity) < 0.01;
                const status = quantityMatch ? 'match' : 'mismatch';
                
                results.push({
                    description: pdfItem.description,
                    pdfDescription: pdfItem.description,
                    excelDescription: bestMatch.item.description,
                    pdfQuantity: pdfItem.quantity,
                    excelQuantity: bestMatch.item.quantity,
                    pdfUnit: pdfItem.unit,
                    excelUnit: bestMatch.item.unit,
                    status: status,
                    similarity: similarity,
                    difference: bestMatch.item.quantity - pdfItem.quantity,
                    quantityMatch: quantityMatch
                });
            } else {
                // Item do PDF não encontrado no Excel
                results.push({
                    description: pdfItem.description,
                    pdfDescription: pdfItem.description,
                    excelDescription: null,
                    pdfQuantity: pdfItem.quantity,
                    excelQuantity: 0,
                    pdfUnit: pdfItem.unit,
                    excelUnit: null,
                    status: 'missing',
                    similarity: 0,
                    difference: -pdfItem.quantity,
                    quantityMatch: false
                });
            }
        });

        // Itens do Excel que não foram encontrados no PDF
        excelItems.forEach((excelItem, index) => {
            if (!matchedExcelIndices.has(index)) {
                results.push({
                    description: excelItem.description,
                    pdfDescription: null,
                    excelDescription: excelItem.description,
                    pdfQuantity: 0,
                    excelQuantity: excelItem.quantity,
                    pdfUnit: null,
                    excelUnit: excelItem.unit,
                    status: 'extra',
                    similarity: 0,
                    difference: excelItem.quantity,
                    quantityMatch: false
                });
            }
        });

        return results;
    }

    findBestMatch(pdfItem, excelItems) {
        let bestMatch = null;
        let highestSimilarity = 0;

        excelItems.forEach((excelItem, index) => {
            const similarity = this.calculateSimilarity(
                pdfItem.description, 
                excelItem.description
            );

            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = { item: excelItem, index: index };
            }
        });

        return { bestMatch, similarity: highestSimilarity };
    }

    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);

        // 1. Verificação exata
        if (s1 === s2) return 1.0;

        // 2. Uma string contém a outra
        if (s1.includes(s2) || s2.includes(s1)) return 0.9;

        // 3. Similaridade por Jaccard (overlap de palavras)
        const tokens1 = new Set(s1.split(/\s+/));
        const tokens2 = new Set(s2.split(/\s+/));
        
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        
        const jaccardSimilarity = intersection.size / union.size;

        // 4. Similaridade por palavras-chave técnicas
        const techKeywords1 = this.extractTechnicalKeywords(s1);
        const techKeywords2 = this.extractTechnicalKeywords(s2);
        
        const commonTechKeywords = techKeywords1.filter(kw => 
            techKeywords2.some(kw2 => this.areTechnicalKeywordsSimilar(kw, kw2))
        );

        const techSimilarity = commonTechKeywords.length / 
            Math.max(techKeywords1.length, techKeywords2.length);

        // Combina as similaridades (dá mais peso para keywords técnicas)
        return Math.max(jaccardSimilarity * 0.6, techSimilarity * 0.8);
    }

    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    extractTechnicalKeywords(text) {
        const stopWords = new Set(['de', 'para', 'em', 'com', 'sem', 'por', 'e', 'ou', 'para', 'no', 'na']);
        const words = text.split(/\s+/);
        
        return words.filter(word => 
            word.length > 2 && 
            !stopWords.has(word) &&
            this.isTechnicalWord(word)
        );
    }

    isTechnicalWord(word) {
        const technicalPatterns = [
            /^\d+[.,]?\d*\s*(mm|mm2|m|un|pç|pol|"|°|w|kw|a|ma|v|kv)/i,
            /(cabo|fio|condutor|elétrico|elétrica)/i,
            /(eletroduto|conduite|tubo|cano)/i,
            /(caixa|passagem|junction|box)/i,
            /(tomada|plug|socket|outlet)/i,
            /(interruptor|switch|comando)/i,
            /(luminária|lâmpada|led|iluminação)/i,
            /(disjuntor|breaker|circuit)/i,
            /(quadro|panel|board|distribution)/i,
            /(parafuso|porca|arruela|fixação)/i,
            /(pvc|metal|aço|ferro|alumínio|plástico)/i
        ];

        return technicalPatterns.some(pattern => pattern.test(word));
    }

    areTechnicalKeywordsSimilar(kw1, kw2) {
        if (kw1 === kw2) return true;
        if (kw1.includes(kw2) || kw2.includes(kw1)) return true;
        
        // Verifica abreviações comuns
        const abbreviations = {
            'mm': 'milimetro', 'mm2': 'milimetro quadrado',
            'un': 'unidade', 'pc': 'peça', 'pç': 'peça',
            'pol': 'polegada', '"': 'polegada',
            'led': 'led', 'lum': 'luminaria'
        };

        return abbreviations[kw1] === kw2 || abbreviations[kw2] === kw1;
    }

    // ==================== INTERFACE ====================
    displayResults() {
        this.updateSummary();
        this.updateTable();
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    }

    updateSummary() {
        const stats = {
            total: this.results.length,
            match: this.results.filter(r => r.status === 'match').length,
            mismatch: this.results.filter(r => r.status === 'mismatch').length,
            missing: this.results.filter(r => r.status === 'missing').length,
            extra: this.results.filter(r => r.status === 'extra').length
        };

        document.getElementById('totalItems').textContent = stats.total;
        document.getElementById('matchItems').textContent = stats.match;
        document.getElementById('mismatchItems').textContent = stats.mismatch;
        document.getElementById('missingItems').textContent = stats.missing + stats.extra;
    }

    updateTable(filter = 'all') {
        const tbody = document.getElementById('tableBody');
        const filteredResults = filter === 'all' 
            ? this.results 
            : this.results.filter(r => r.status === filter);

        tbody.innerHTML = filteredResults.map(item => `
            <tr>
                <td class="status-${item.status}">
                    ${this.getStatusIcon(item.status)} ${this.getStatusText(item.status)}
                </td>
                <td>
                    <div class="description">${item.description}</div>
                    ${item.pdfDescription !== item.excelDescription ? 
                        `<div class="description-diff">
                            <small>PDF: ${item.pdfDescription || 'N/A'}</small><br>
                            <small>Excel: ${item.excelDescription || 'N/A'}</small>
                        </div>` : ''
                    }
                </td>
                <td>${item.pdfQuantity || 0} ${item.pdfUnit || ''}</td>
                <td>${item.excelQuantity || 0} ${item.excelUnit || ''}</td>
                <td class="${item.difference > 0 ? 'difference-positive' : 'difference-negative'}">
                    ${item.difference > 0 ? '+' : ''}${item.difference}
                </td>
                <td class="${this.getSimilarityClass(item.similarity)}">
                    ${(item.similarity * 100).toFixed(0)}%
                </td>
            </tr>
        `).join('');
    }

    getStatusIcon(status) {
        const icons = {
            'match': '✅',
            'mismatch': '❌', 
            'missing': '⚠️',
            'extra': '📋'
        };
        return icons[status] || '🔍';
    }

    getStatusText(status) {
        const texts = {
            'match': 'Correto',
            'mismatch': 'Discrepante',
            'missing': 'Faltante', 
            'extra': 'Extra'
        };
        return texts[status] || status;
    }

    getSimilarityClass(similarity) {
        if (similarity >= 0.8) return 'similarity-high';
        if (similarity >= 0.5) return 'similarity-medium';
        return 'similarity-low';
    }

    filterTable(filter) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        this.updateTable(filter);
    }

    exportToExcel() {
        if (!this.results.length) {
            alert('Nenhum resultado para exportar');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();
            const wsData = [
                ['Status', 'Descrição', 'Quantidade PDF', 'Quantidade Excel', 'Diferença', 'Similaridade']
            ];

            this.results.forEach(item => {
                wsData.push([
                    this.getStatusText(item.status),
                    item.description,
                    item.pdfQuantity || 0,
                    item.excelQuantity || 0,
                    item.difference,
                    `${(item.similarity * 100).toFixed(0)}%`
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
            XLSX.writeFile(wb, 'comparacao_materiais.xlsx');
            
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Erro ao exportar para Excel');
        }
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('compareBtn').disabled = show;
    }

    checkFilesReady() {
        const btn = document.getElementById('compareBtn');
        btn.disabled = !(this.pdfFile && this.excelFile);
    }
}

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    new MaterialComparator();
});
