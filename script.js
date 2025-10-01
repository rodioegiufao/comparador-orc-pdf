// script.js - Versão com debug e parsers melhorados
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
        this.showLoading(true);

        try {
            if (type === 'pdf') {
                this.pdfFile = file;
                this.pdfData = await this.parsePDF(file);
                infoElement.textContent = `Itens detectados: ${this.pdfData.length} | Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
                
                // Debug: mostra primeiros itens detectados
                console.log('PDF Data:', this.pdfData.slice(0, 5));
            } else {
                this.excelFile = file;
                this.excelData = await this.parseExcel(file);
                infoElement.textContent = `Itens detectados: ${this.excelData.length} | Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
                
                // Debug: mostra primeiros itens detectados
                console.log('Excel Data:', this.excelData.slice(0, 5));
            }
        } catch (error) {
            console.error(`Erro ao processar ${type}:`, error);
            infoElement.textContent = `Erro: ${error.message}`;
        } finally {
            this.showLoading(false);
            this.checkFilesReady();
        }
    }

    // ==================== PARSER DE PDF MELHORADO ====================
    async parsePDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            console.log(`PDF tem ${pdf.numPages} páginas`);

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
                
                console.log(`Página ${i}: ${pageText.substring(0, 100)}...`);
            }

            const materials = this.parseMaterialsFromPDFText(fullText);
            console.log(`Total de materiais detectados no PDF: ${materials.length}`);
            
            if (materials.length === 0) {
                // Se não detectou nada, mostra o texto extraído para debug
                console.log('Texto extraído do PDF:', fullText.substring(0, 1000));
            }
            
            return materials;
        } catch (error) {
            console.error('Erro ao parsear PDF:', error);
            throw new Error('Falha ao ler o arquivo PDF: ' + error.message);
        }
    }

    parseMaterialsFromPDFText(text) {
        const materials = [];
        const lines = text.split('\n');
        
        console.log(`Total de linhas no PDF: ${lines.length}`);

        let inMaterialsSection = false;
        let currentSection = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Debug: mostra linhas que parecem ser cabeçalhos
            if (line.includes('MATERIAIS') || line.includes('Lista') || line.includes('COMPOSIÇÃO')) {
                console.log(`Cabeçalho detectado: "${line}"`);
            }

            // Detecta seções principais - critérios mais flexíveis
            if (this.isMaterialsSection(line)) {
                inMaterialsSection = true;
                console.log(`Entrou na seção de materiais: "${line}"`);
                continue;
            }

            if (line.includes('METROS') || line.toLowerCase().includes('metros')) {
                currentSection = 'meters';
                continue;
            }

            if (line.includes('UNIDADES') || line.toLowerCase().includes('unidades')) {
                currentSection = 'units';
                continue;
            }

            if (!inMaterialsSection) {
                continue;
            }

            // Pula linhas vazias ou que são claramente cabeçalhos
            if (!line || this.isHeaderLine(line) || this.isLikelyHeader(line)) {
                continue;
            }

            // Tenta parsear a linha como item de material com múltiplos padrões
            const material = this.parseMaterialLineFlexible(line, currentSection);
            if (material) {
                materials.push(material);
                console.log(`Item detectado: "${material.description}" - ${material.quantity} ${material.unit}`);
            } else {
                // Debug: mostra linhas que não foram parseadas (mas estão na seção de materiais)
                if (line.length > 10 && !this.isHeaderLine(line)) {
                    console.log(`Linha não parseada: "${line}"`);
                }
            }
        }

        return materials;
    }

    isMaterialsSection(line) {
        const sectionKeywords = [
            'lista de materiais', 'materiais', 'composição', 'material', 
            'itens', 'componentes', 'insumos', 'LISTA DE MATERIAIS',
            'COMPOSIÇÃO PRÓPRIA', 'SINAPI', 'METROS', 'UNIDADES'
        ];
        
        const lowerLine = line.toLowerCase();
        return sectionKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase()));
    }

    isLikelyHeader(line) {
        return /^(DESCRIÇÃO|ITEM|QTD|QUANT|UNID|===|---|###)/i.test(line) ||
               line.split(' ').length < 3; // Linhas muito curtas provavelmente são cabeçalhos
    }

    parseMaterialLineFlexible(line, section) {
        // Múltiplos padrões em ordem de prioridade
        const patterns = [
            // Padrão 1: "DESCRIÇÃO 123.45 m" (mais comum)
            /^([A-Za-z][^0-9\n]{10,}?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm|mm²|mm2|"|polegada|w|kw)?\s*$/i,
            
            // Padrão 2: "- DESCRIÇÃO 123.45 m" (com marcador)
            /^[-•*]\s*([^0-9\n]{10,}?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm)?\s*$/i,
            
            // Padrão 3: "123.45 m DESCRIÇÃO" (quantidade primeiro)
            /^(\d+[.,]\d+|\d+)\s*(m|un|pç)\s+([^0-9\n]{10,})$/i,
            
            // Padrão 4: "DESCRIÇÃO 123 un" (sem unidade explícita)
            /^([A-Za-z][^0-9\n]{10,}?)\s+(\d+[.,]\d+|\d+)\s*$/,
            
            // Padrão 5: Para cabos específicos "CABO XXX X.X MM2"
            /^(CABO[^0-9\n]+?MM2?)\s+(\d+[.,]\d+|\d+)\s*(m)?/i,
            
            // Padrão 6: "DESCRIÇÃO 123" (apenas número)
            /^([A-Za-z][^0-9\n]{10,}?)\s+(\d+)$/,
            
            // Padrão 7: Linhas com unidades no meio do texto
            /^(.+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç)\s+(.+)?$/i
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                let description, quantity, unit;

                if (pattern === patterns[2]) {
                    // Padrão com marcador
                    [, description, quantity, unit] = match;
                } else if (pattern === patterns[5]) {
                    // Padrão para cabos
                    [, description, quantity, unit] = match;
                    unit = unit || 'm'; // Cabos geralmente são em metros
                } else if (pattern === patterns[6] || pattern === patterns[3]) {
                    // Padrão apenas número ou quantidade primeiro
                    if (pattern === patterns[3]) {
                        [, quantity, unit, description] = match;
                    } else {
                        [, description, quantity] = match;
                        unit = this.inferUnit(section);
                    }
                } else {
                    // Padrões normais
                    [, description, quantity, unit] = match;
                }

                // Limpa e valida o resultado
                description = this.cleanDescription(description);
                quantity = this.parseQuantity(quantity);
                unit = this.normalizeUnit(unit || this.inferUnit(section));

                if (description && description.length > 5 && !isNaN(quantity) && quantity > 0) {
                    return {
                        description: description,
                        quantity: quantity,
                        unit: unit,
                        rawLine: line
                    };
                }
            }
        }

        return null;
    }

    cleanDescription(desc) {
        if (!desc) return '';
        
        return desc
            .replace(/^[-•*]\s*/, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*\.$/, '') // Remove ponto final
            .trim();
    }

    parseQuantity(qtyStr) {
        if (typeof qtyStr === 'number') return qtyStr;
        return parseFloat(qtyStr.toString().replace(',', '.')) || 0;
    }

    normalizeUnit(unit) {
        if (!unit) return 'un';
        
        const unitMap = {
            'm': 'm', 'metro': 'm', 'metros': 'm', 'mt': 'm',
            'un': 'un', 'unid': 'un', 'unidade': 'un', 'unidades': 'un', 'und': 'un',
            'pç': 'pç', 'pc': 'pç', 'peça': 'pç', 'peças': 'pç',
            'mm': 'mm', 'milimetro': 'mm', 'mm2': 'mm²', 'mm²': 'mm²',
            '"': 'polegada', 'polegada': 'polegada', 'pol': 'polegada',
            'w': 'w', 'kw': 'kw'
        };
        
        const normalized = unit.toLowerCase().trim();
        return unitMap[normalized] || 'un';
    }

    inferUnit(section) {
        return section === 'meters' ? 'm' : 'un';
    }

    isHeaderLine(line) {
        return /^(DESCRIÇÃO|ITEM|QUANTIDADE|UNIDADE|===|---|###|Item|Descrição|Quantidade|Unidade)/i.test(line);
    }

    // ==================== PARSER DE EXCEL MELHORADO ====================
    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    console.log('Planilhas no Excel:', workbook.SheetNames);
                    
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    
                    console.log('Dados brutos do Excel:', jsonData.slice(0, 10));
                    
                    const materials = this.parseExcelData(jsonData);
                    console.log(`Materiais detectados no Excel: ${materials.length}`);
                    
                    resolve(materials);
                } catch (error) {
                    console.error('Erro detalhado do Excel:', error);
                    reject(new Error('Erro ao ler arquivo Excel: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Erro ao ler arquivo Excel'));
            reader.readAsArrayBuffer(file);
        });
    }

    parseExcelData(jsonData) {
        const materials = [];
        
        if (!jsonData || jsonData.length === 0) {
            console.log('Excel vazio ou sem dados');
            return materials;
        }

        // Encontra a linha de cabeçalho
        const headerRowIndex = this.findHeaderRow(jsonData);
        console.log(`Linha de cabeçalho encontrada: ${headerRowIndex}`);
        
        if (headerRowIndex === -1) {
            // Tenta usar a primeira linha como dados se não encontrar cabeçalho claro
            console.log('Nenhum cabeçalho claro encontrado, tentando parsear todas as linhas...');
            return this.parseExcelWithoutHeader(jsonData);
        }

        const headers = jsonData[headerRowIndex].map(h => this.normalizeHeader(h));
        console.log('Cabeçalhos detectados:', headers);
        
        const colMap = this.mapExcelColumns(headers);
        console.log('Mapeamento de colunas:', colMap);
        
        // Processa linhas de dados
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const material = this.parseExcelRow(row, colMap);
            if (material) {
                materials.push(material);
                console.log(`Item Excel: "${material.description}" - ${material.quantity} ${material.unit}`);
            }
        }

        return materials;
    }

    parseExcelWithoutHeader(jsonData) {
        const materials = [];
        const possibleColumns = this.guessExcelColumns(jsonData);
        
        console.log('Tentando parsear sem cabeçalho. Colunas possíveis:', possibleColumns);

        jsonData.forEach((row, index) => {
            if (!row || row.length === 0) return;

            // Tenta cada combinação possível de colunas
            for (const colMap of possibleColumns) {
                const material = this.parseExcelRow(row, colMap);
                if (material && material.description && material.quantity > 0) {
                    materials.push(material);
                    console.log(`Item detectado (linha ${index}): "${material.description}"`);
                    break;
                }
            }
        });

        return materials;
    }

    guessExcelColumns(jsonData) {
        // Analisa as primeiras linhas para tentar adivinhar as colunas
        const sampleRows = jsonData.slice(0, Math.min(10, jsonData.length));
        const possibleMappings = [];
        
        // Padrões comuns de colunas
        const commonPatterns = [
            { description: 1, quantity: 4, unit: 5 }, // Padrão comum em orçamentos
            { description: 3, quantity: 4, unit: 5 }, // Outro padrão comum
            { description: 2, quantity: 3, unit: 4 }, 
            { description: 0, quantity: 1, unit: 2 }  // Padrão simples
        ];

        // Testa cada padrão
        for (const pattern of commonPatterns) {
            let validCount = 0;
            
            for (const row of sampleRows) {
                if (row && row.length > Math.max(pattern.description, pattern.quantity, pattern.unit || 0)) {
                    const desc = row[pattern.description];
                    const qty = row[pattern.quantity];
                    
                    if (desc && typeof desc === 'string' && desc.length > 5 && 
                        (typeof qty === 'number' || (typeof qty === 'string' && !isNaN(parseFloat(qty))))) {
                        validCount++;
                    }
                }
            }
            
            if (validCount > sampleRows.length * 0.5) { // Pelo menos 50% das linhas batem
                possibleMappings.push(pattern);
            }
        }

        return possibleMappings.length > 0 ? possibleMappings : [{ description: 3, quantity: 4, unit: 5 }];
    }

    findHeaderRow(jsonData) {
        const headerKeywords = ['descrição', 'item', 'material', 'quantidade', 'qtd', 'unidade', 'und', 'descricao'];
        
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const row = jsonData[i] || [];
            if (row.length === 0) continue;
            
            const rowText = row.join(' ').toLowerCase();
            const normalizedRow = this.normalizeText(rowText);
            
            const matchCount = headerKeywords.filter(keyword => 
                normalizedRow.includes(keyword)
            ).length;
            
            console.log(`Linha ${i}: "${rowText.substring(0, 50)}..." - matches: ${matchCount}`);
            
            if (matchCount >= 2) {
                return i;
            }
        }
        
        return -1;
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
            const normalizedHeader = this.normalizeHeader(header);
            
            if (normalizedHeader.includes('descricao') || normalizedHeader.includes('item') || normalizedHeader.includes('material')) {
                mapping.description = index;
            } else if (normalizedHeader.includes('quantidade') || normalizedHeader.includes('qtd')) {
                mapping.quantity = index;
            } else if (normalizedHeader.includes('unidade') || normalizedHeader.includes('und')) {
                mapping.unit = index;
            }
        });

        // Garante que pelo menos description e quantity estão mapeados
        if (mapping.description === undefined) {
            // Tenta encontrar coluna de descrição por processo de eliminação
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                if (header && header.length > 5 && !this.looksLikeNumber(header) && !this.looksLikeUnit(header)) {
                    mapping.description = i;
                    break;
                }
            }
        }

        if (mapping.quantity === undefined) {
            // Tenta encontrar coluna de quantidade
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                if (this.looksLikeNumber(header) || (header && header.length <= 5)) {
                    mapping.quantity = i;
                    break;
                }
            }
        }

        return mapping;
    }

    looksLikeNumber(text) {
        return /^\d+([.,]\d+)?$/.test(text);
    }

    looksLikeUnit(text) {
        return /^(m|un|pç|und|unid|kg|cm|mm)$/i.test(text);
    }

    parseExcelRow(row, colMap) {
        const description = row[colMap.description];
        let quantity = row[colMap.quantity];
        const unit = row[colMap.unit];

        if (!description || description === '' || quantity === undefined || quantity === null || quantity === '') {
            return null;
        }

        // Converte quantidade para número
        if (typeof quantity === 'string') {
            quantity = this.parseQuantity(quantity);
        }

        // Se quantidade é 0 ou NaN, pula
        if (isNaN(quantity) || quantity === 0) {
            return null;
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
        return this.normalizeUnit(unit);
    }

    // ==================== COMPARAÇÃO ====================
    async compareFiles() {
        this.showLoading(true);
        
        try {
            console.log('Iniciando comparação...');
            console.log(`PDF items: ${this.pdfData.length}, Excel items: ${this.excelData.length}`);

            if (this.pdfData.length === 0 && this.excelData.length === 0) {
                throw new Error('Nenhum item detectado em nenhum arquivo. Verifique os formatos.');
            } else if (this.pdfData.length === 0) {
                throw new Error('Nenhum item detectado no PDF. Verifique se é uma lista de materiais.');
            } else if (this.excelData.length === 0) {
                throw new Error('Nenhum item detectado no Excel. Verifique o formato da planilha.');
            }

            this.results = await this.compareMaterials(this.pdfData, this.excelData);
            this.displayResults();
            
        } catch (error) {
            console.error('Erro na comparação:', error);
            alert('Erro: ' + error.message + '\n\nVerifique o console (F12) para mais detalhes.');
        } finally {
            this.showLoading(false);
        }
    }

    // ... (o resto do código de comparação permanece igual) ...
    // [Mantém todo o código de compareMaterials, findBestMatch, calculateSimilarity, etc.]

}

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    new MaterialComparator();
});
