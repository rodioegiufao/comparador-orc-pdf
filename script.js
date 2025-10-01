// script.js - Versão com debug visual
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
        
        previewElement.innerHTML = `
            <p><strong>${file.name}</strong></p>
            <div class="debug-info" id="${type}Debug"></div>
        `;
        
        this.showLoading(true);

        try {
            if (type === 'pdf') {
                this.pdfFile = file;
                const result = await this.parsePDFWithDebug(file);
                this.pdfData = result.materials;
                
                infoElement.textContent = `Itens detectados: ${this.pdfData.length}`;
                document.getElementById('pdfDebug').innerHTML = result.debugInfo;
                
            } else {
                this.excelFile = file;
                const result = await this.parseExcelWithDebug(file);
                this.excelData = result.materials;
                
                infoElement.textContent = `Itens detectados: ${this.excelData.length}`;
                document.getElementById('excelDebug').innerHTML = result.debugInfo;
            }
        } catch (error) {
            console.error(`Erro ao processar ${type}:`, error);
            infoElement.textContent = `Erro: ${error.message}`;
        } finally {
            this.showLoading(false);
            this.checkFilesReady();
        }
    }

    // ==================== PARSER DE PDF COM DEBUG ====================
    async parsePDFWithDebug(file) {
        const debugInfo = [];
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            debugInfo.push(`<h4>📄 Informações do PDF:</h4>`);
            debugInfo.push(`<p>Número de páginas: ${pdf.numPages}</p>`);

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
                
                if (i === 1) {
                    debugInfo.push(`<p><strong>Primeira página (início):</strong><br>${pageText.substring(0, 500)}...</p>`);
                }
            }

            const materials = this.parseMaterialsFromPDFText(fullText, debugInfo);
            
            debugInfo.push(`<h4>🔍 Resultado da Análise:</h4>`);
            debugInfo.push(`<p>Total de materiais detectados: <strong>${materials.length}</strong></p>`);
            
            if (materials.length > 0) {
                debugInfo.push(`<div class="detected-items"><strong>Itens detectados:</strong><ul>`);
                materials.slice(0, 10).forEach(item => {
                    debugInfo.push(`<li>${item.description} - ${item.quantity} ${item.unit}</li>`);
                });
                if (materials.length > 10) {
                    debugInfo.push(`<li>... e mais ${materials.length - 10} itens</li>`);
                }
                debugInfo.push(`</ul></div>`);
            } else {
                debugInfo.push(`<div class="no-items"><strong>Nenhum item detectado!</strong></div>`);
                debugInfo.push(`<details><summary>Ver texto extraído completo</summary><pre>${fullText}</pre></details>`);
            }

            return {
                materials: materials,
                debugInfo: debugInfo.join('')
            };

        } catch (error) {
            debugInfo.push(`<div class="error">Erro ao processar PDF: ${error.message}</div>`);
            return {
                materials: [],
                debugInfo: debugInfo.join('')
            };
        }
    }

    parseMaterialsFromPDFText(text, debugInfo) {
        const materials = [];
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        debugInfo.push(`<p>Total de linhas no PDF: ${lines.length}</p>`);

        let inMaterialsSection = false;
        let materialsSectionStart = -1;

        // Procura pela seção de materiais
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (this.isMaterialsSection(line)) {
                inMaterialsSection = true;
                materialsSectionStart = i;
                debugInfo.push(`<p>🏁 Seção de materiais encontrada na linha ${i + 1}: "${line}"</p>`);
                break;
            }
        }

        // Se não encontrou seção específica, usa o arquivo todo
        if (!inMaterialsSection) {
            debugInfo.push(`<p>⚠️ Seção de materiais não encontrada. Analisando todo o documento.</p>`);
            materialsSectionStart = 0;
            inMaterialsSection = true;
        }

        // Analisa as linhas a partir da seção de materiais
        for (let i = materialsSectionStart; i < Math.min(materialsSectionStart + 200, lines.length); i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const material = this.parseMaterialLine(line);
            if (material) {
                materials.push(material);
                if (materials.length <= 5) {
                    debugInfo.push(`<p>✅ Item ${materials.length}: "${material.description}" - ${material.quantity} ${material.unit}</p>`);
                }
            }
        }

        return materials;
    }

    isMaterialsSection(line) {
        const sectionKeywords = [
            'lista de materiais', 'materiais', 'composição', 'material', 
            'itens', 'componentes', 'insumos', 'LISTA DE MATERIAIS',
            'COMPOSIÇÃO PRÓPRIA', 'SINAPI', 'METROS', 'UNIDADES',
            'Lista de materiais -', 'MATERIAIS -', 'COMPOSIÇÃO -'
        ];
        
        const lowerLine = line.toLowerCase();
        return sectionKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase()));
    }

    parseMaterialLine(line) {
        // Remove espaços extras
        line = line.replace(/\s+/g, ' ').trim();
        
        // Padrão mais simples: número no final da linha
        const simplePattern = /^(.+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm|mm²|mm2|"|pol)?\s*$/i;
        const match = line.match(simplePattern);
        
        if (match) {
            let [, description, quantity, unit] = match;
            
            // Limpa a descrição
            description = description.replace(/^[-•*]\s*/, '').trim();
            
            // Converte quantidade
            quantity = parseFloat(quantity.replace(',', '.'));
            
            // Define unidade padrão se não especificada
            unit = unit ? this.normalizeUnit(unit) : 'un';
            
            // Valida: descrição deve ter pelo menos 3 caracteres, quantidade deve ser número válido
            if (description.length >= 3 && !isNaN(quantity) && quantity > 0) {
                return {
                    description: description,
                    quantity: quantity,
                    unit: unit,
                    rawLine: line
                };
            }
        }
        
        return null;
    }

    // ==================== PARSER DE EXCEL COM DEBUG ====================
    async parseExcelWithDebug(file) {
        const debugInfo = [];
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    debugInfo.push(`<h4>📊 Informações do Excel:</h4>`);
                    debugInfo.push(`<p>Planilhas encontradas: ${workbook.SheetNames.join(', ')}</p>`);
                    
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    
                    debugInfo.push(`<p>Total de linhas: ${jsonData.length}</p>`);
                    
                    // Mostra as primeiras linhas para debug
                    if (jsonData.length > 0) {
                        debugInfo.push(`<details><summary>Ver primeiras 5 linhas do Excel</summary>`);
                        debugInfo.push(`<table class="debug-table">`);
                        jsonData.slice(0, 5).forEach((row, index) => {
                            debugInfo.push(`<tr><td>Linha ${index}:</td><td>${JSON.stringify(row)}</td></tr>`);
                        });
                        debugInfo.push(`</table></details>`);
                    }
                    
                    const materials = this.parseExcelData(jsonData, debugInfo);
                    
                    debugInfo.push(`<h4>🔍 Resultado da Análise:</h4>`);
                    debugInfo.push(`<p>Total de materiais detectados: <strong>${materials.length}</strong></p>`);
                    
                    if (materials.length > 0) {
                        debugInfo.push(`<div class="detected-items"><strong>Itens detectados:</strong><ul>`);
                        materials.slice(0, 10).forEach(item => {
                            debugInfo.push(`<li>${item.description} - ${item.quantity} ${item.unit}</li>`);
                        });
                        if (materials.length > 10) {
                            debugInfo.push(`<li>... e mais ${materials.length - 10} itens</li>`);
                        }
                        debugInfo.push(`</ul></div>`);
                    } else {
                        debugInfo.push(`<div class="no-items"><strong>Nenhum item detectado!</strong></div>`);
                    }

                    resolve({
                        materials: materials,
                        debugInfo: debugInfo.join('')
                    });

                } catch (error) {
                    debugInfo.push(`<div class="error">Erro ao processar Excel: ${error.message}</div>`);
                    resolve({
                        materials: [],
                        debugInfo: debugInfo.join('')
                    });
                }
            };
            
            reader.onerror = () => {
                debugInfo.push(`<div class="error">Erro ao ler arquivo Excel</div>`);
                resolve({
                    materials: [],
                    debugInfo: debugInfo.join('')
                });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    parseExcelData(jsonData, debugInfo) {
        const materials = [];
        
        if (!jsonData || jsonData.length === 0) {
            return materials;
        }

        // Procura por linhas que parecem conter materiais
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row)) continue;

            // Tenta encontrar descrição e quantidade em qualquer coluna
            for (let descCol = 0; descCol < row.length; descCol++) {
                const description = row[descCol];
                if (!description || typeof description !== 'string') continue;
                
                // Procura por quantidade nas colunas seguintes
                for (let qtyCol = descCol + 1; qtyCol < Math.min(descCol + 4, row.length); qtyCol++) {
                    const quantity = row[qtyCol];
                    
                    if (this.isValidQuantity(quantity) && description.length > 5) {
                        const material = {
                            description: description.trim(),
                            quantity: this.parseQuantity(quantity),
                            unit: 'un', // Assume unidade como padrão
                            rawData: row
                        };
                        
                        materials.push(material);
                        break;
                    }
                }
            }
        }

        return materials;
    }

    isValidQuantity(value) {
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            const num = parseFloat(value.replace(',', '.'));
            return !isNaN(num) && num > 0;
        }
        return false;
    }

    // ==================== FUNÇÕES AUXILIARES ====================
    normalizeUnit(unit) {
        if (!unit) return 'un';
        
        const unitMap = {
            'm': 'm', 'metro': 'm', 'metros': 'm', 'mt': 'm',
            'un': 'un', 'unid': 'un', 'unidade': 'un', 'unidades': 'un', 'und': 'un',
            'pç': 'pç', 'pc': 'pç', 'peça': 'pç', 'peças': 'pç',
            'mm': 'mm', 'milimetro': 'mm', 'mm2': 'mm²', 'mm²': 'mm²'
        };
        
        const normalized = unit.toLowerCase().trim();
        return unitMap[normalized] || 'un';
    }

    parseQuantity(qtyStr) {
        if (typeof qtyStr === 'number') return qtyStr;
        return parseFloat(qtyStr.toString().replace(',', '.')) || 0;
    }

    // ==================== COMPARAÇÃO SIMPLIFICADA ====================
    async compareFiles() {
        this.showLoading(true);
        
        try {
            console.log('PDF Data:', this.pdfData);
            console.log('Excel Data:', this.excelData);

            if (this.pdfData.length === 0 && this.excelData.length === 0) {
                throw new Error(`
                    Nenhum item detectado nos arquivos. 
                    
                    PDF: Verifique se é uma lista de materiais em formato de texto (não escaneado)
                    Excel: Verifique se tem colunas com descrição e quantidade
                    
                    Veja as informações de debug acima para detalhes.
                `);
            }

            // Se não detectou itens em um dos arquivos, usa dados de exemplo para teste
            if (this.pdfData.length === 0 || this.excelData.length === 0) {
                const useSample = confirm(`
                    Detectamos itens em apenas um arquivo. 
                    Deseja usar dados de exemplo para testar a comparação?
                `);
                
                if (useSample) {
                    this.generateSampleData();
                } else {
                    throw new Error('Compare arquivos com itens detectados em ambos.');
                }
            }

            this.results = await this.compareMaterials(this.pdfData, this.excelData);
            this.displayResults();
            
        } catch (error) {
            console.error('Erro na comparação:', error);
            alert(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    generateSampleData() {
        // Dados de exemplo para teste
        if (this.pdfData.length === 0) {
            this.pdfData = [
                { description: "CABO ISOLADO PP 3 X 1,5 MM2", quantity: 312.4, unit: "m" },
                { description: "ELETRODUTO FLEXÍVEL CORRUGADO 3/4", quantity: 82.9, unit: "m" },
                { description: "CAIXA DE PASSAGEM PVC 4X2", quantity: 21, unit: "un" }
            ];
        }
        
        if (this.excelData.length === 0) {
            this.excelData = [
                { description: "CABO ISOLADO PP 3 X 1,5 MM2", quantity: 312.4, unit: "m" },
                { description: "ELETRODUTO FLEXÍVEL CORRUGADO 3/4", quantity: 80, unit: "m" },
                { description: "CAIXA PVC 4X2", quantity: 21, unit: "un" }
            ];
        }
    }

    async compareMaterials(pdfItems, excelItems) {
        const results = [];
        
        // Comparação simples por similaridade de texto
        pdfItems.forEach(pdfItem => {
            let bestMatch = null;
            let bestSimilarity = 0;

            excelItems.forEach(excelItem => {
                const similarity = this.calculateSimpleSimilarity(pdfItem.description, excelItem.description);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = excelItem;
                }
            });

            if (bestMatch && bestSimilarity > 0.3) {
                const status = pdfItem.quantity === bestMatch.quantity ? 'match' : 'mismatch';
                results.push({
                    description: pdfItem.description,
                    pdfQuantity: pdfItem.quantity,
                    excelQuantity: bestMatch.quantity,
                    pdfUnit: pdfItem.unit,
                    excelUnit: bestMatch.unit,
                    status: status,
                    similarity: bestSimilarity,
                    difference: bestMatch.quantity - pdfItem.quantity
                });
            } else {
                results.push({
                    description: pdfItem.description,
                    pdfQuantity: pdfItem.quantity,
                    excelQuantity: 0,
                    pdfUnit: pdfItem.unit,
                    excelUnit: '',
                    status: 'missing',
                    similarity: 0,
                    difference: -pdfItem.quantity
                });
            }
        });

        return results;
    }

    calculateSimpleSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1 === s2) return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;
        
        const words1 = s1.split(/\s+/);
        const words2 = s2.split(/\s+/);
        
        const commonWords = words1.filter(word => 
            words2.some(w2 => w2.includes(word) || word.includes(w2))
        );
        
        return commonWords.length / Math.max(words1.length, words2.length);
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
            missing: this.results.filter(r => r.status === 'missing').length
        };

        document.getElementById('totalItems').textContent = stats.total;
        document.getElementById('matchItems').textContent = stats.match;
        document.getElementById('mismatchItems').textContent = stats.mismatch;
        document.getElementById('missingItems').textContent = stats.missing;
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
                <td>${item.description}</td>
                <td>${item.pdfQuantity} ${item.pdfUnit}</td>
                <td>${item.excelQuantity} ${item.excelUnit}</td>
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
        const icons = { 'match': '✅', 'mismatch': '❌', 'missing': '⚠️' };
        return icons[status] || '🔍';
    }

    getStatusText(status) {
        const texts = { 'match': 'Correto', 'mismatch': 'Discrepante', 'missing': 'Faltante' };
        return texts[status] || status;
    }

    getSimilarityClass(similarity) {
        if (similarity >= 0.8) return 'similarity-high';
        if (similarity >= 0.5) return 'similarity-medium';
        return 'similarity-low';
    }

    filterTable(filter) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        this.updateTable(filter);
    }

    exportToExcel() {
        if (!this.results.length) {
            alert('Nenhum resultado para exportar');
            return;
        }
        alert('Exportação para Excel - Em desenvolvimento');
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
