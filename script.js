// script.js - Sistema com análise automática (CORRIGIDO)
class SmartComparator {
    constructor() {
        this.pdfItems = [];
        this.excelItems = [];
        this.results = [];
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Eventos que existem desde o início
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeFiles());
        
        // Eventos de filtro - adicionamos depois quando os elementos forem criados
        // document.getElementById('exportResultsBtn') será adicionado depois
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const previewElement = document.getElementById(`${type}Preview`);
        previewElement.innerHTML = `<p><strong>${file.name}</strong> - Processando...</p>`;

        this.showLoading(true);

        try {
            if (type === 'pdf') {
                const pdfText = await this.extractPDFText(file);
                this.pdfItems = this.parsePDFMaterials(pdfText);
                previewElement.innerHTML = `<p><strong>${file.name}</strong> ✅ (${this.pdfItems.length} itens)</p>`;
                console.log('Itens do PDF:', this.pdfItems);
            } else {
                const excelData = await this.extractExcelData(file);
                this.excelItems = this.parseExcelMaterials(excelData);
                previewElement.innerHTML = `<p><strong>${file.name}</strong> ✅ (${this.excelItems.length} itens)</p>`;
                console.log('Itens do Excel:', this.excelItems);
            }
        } catch (error) {
            console.error(`Erro ao processar ${type}:`, error);
            previewElement.innerHTML = `<p><strong>${file.name}</strong> ❌ Erro: ${error.message}</p>`;
        } finally {
            this.showLoading(false);
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

    parsePDFMaterials(text) {
        const materials = [];
        const lines = text.split('\n');
        
        console.log('Analisando PDF... Total de linhas:', lines.length);

        // Padrões para detectar materiais
        const patterns = [
            /(.+?)\s+(\d+[.,]\d+|\d+)\s*(m|un|pç|mm|mm2|mm²)/i,
            /(\d+[.,]\d+|\d+)\s*(m|un|pç)\s+(.+)/i,
            /[-•]\s*(.+?)\s+(\d+[.,]\d+|\d+)/i
        ];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 5) return;

            for (const pattern of patterns) {
                const match = trimmed.match(pattern);
                if (match) {
                    let description, quantity, unit;

                    if (pattern === patterns[1]) {
                        // Padrão: "123.45 m DESCRIÇÃO"
                        [, quantity, unit, description] = match;
                    } else if (pattern === patterns[2]) {
                        // Padrão: "- DESCRIÇÃO 123"
                        [, description, quantity] = match;
                        unit = 'un';
                    } else {
                        // Padrão: "DESCRIÇÃO 123.45 m"
                        [, description, quantity, unit] = match;
                    }

                    description = this.cleanDescription(description);
                    quantity = this.parseQuantity(quantity);
                    unit = this.normalizeUnit(unit);

                    if (description && description.length > 3 && !isNaN(quantity) && quantity > 0) {
                        materials.push({ 
                            description, 
                            quantity, 
                            unit, 
                            source: 'PDF',
                            linha: index + 1
                        });
                        console.log(`✅ Item detectado: "${description}" - ${quantity} ${unit}`);
                        break;
                    }
                }
            }
        });

        console.log(`📊 Total de itens detectados no PDF: ${materials.length}`);
        return materials;
    }

    async extractExcelData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    parseExcelMaterials(jsonData) {
        const materials = [];
        
        console.log('Analisando Excel... Total de linhas:', jsonData.length);

        // Procura por linhas que contenham descrição e quantidade
        jsonData.forEach((row, rowIndex) => {
            if (!Array.isArray(row)) return;

            for (let i = 0; i < row.length - 1; i++) {
                const cell = row[i];
                if (typeof cell === 'string' && cell.length > 5) {
                    // Procura por número nas células seguintes
                    for (let j = i + 1; j < Math.min(i + 3, row.length); j++) {
                        const nextCell = row[j];
                        const quantity = this.parseQuantity(nextCell);
                        
                        if (!isNaN(quantity) && quantity > 0) {
                            const material = {
                                description: this.cleanDescription(cell),
                                quantity: quantity,
                                unit: 'un',
                                source: 'Excel',
                                linha: rowIndex + 1
                            };
                            materials.push(material);
                            console.log(`✅ Item detectado: "${material.description}" - ${quantity} un`);
                            break;
                        }
                    }
                }
            }
        });

        console.log(`📊 Total de itens detectados no Excel: ${materials.length}`);
        return materials;
    }

    cleanDescription(desc) {
        return desc
            .replace(/^[-•*]\s*/, '')
            .replace(/\s+/g, ' ')
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

    checkFilesReady() {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = !(this.pdfItems.length > 0 && this.excelItems.length > 0);
        
        if (!btn.disabled) {
            console.log('✅ Arquivos prontos para análise!');
            console.log(`📄 PDF: ${this.pdfItems.length} itens`);
            console.log(`📊 Excel: ${this.excelItems.length} itens`);
        }
    }

    async analyzeFiles() {
        this.showLoading(true);

        try {
            console.log('🔍 Iniciando análise comparativa...');
            console.log('Itens do PDF:', this.pdfItems);
            console.log('Itens do Excel:', this.excelItems);

            this.results = await this.compareItems(this.pdfItems, this.excelItems);
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Erro na análise:', error);
            alert('Erro na análise: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async compareItems(pdfItems, excelItems) {
        const results = [];
        const matchedExcelIndices = new Set();

        console.log('🔄 Comparando itens...');

        // Para cada item do PDF, busca correspondente no Excel
        pdfItems.forEach(pdfItem => {
            let bestMatch = null;
            let bestSimilarity = 0;

            excelItems.forEach((excelItem, excelIndex) => {
                const similarity = this.calculateSimilarity(pdfItem.description, excelItem.description);
                
                if (similarity > bestSimilarity && similarity > 0.3) {
                    bestSimilarity = similarity;
                    bestMatch = { item: excelItem, index: excelIndex };
                }
            });

            if (bestMatch) {
                matchedExcelIndices.add(bestMatch.index);
                const excelItem = bestMatch.item;
                
                const quantityMatch = Math.abs(pdfItem.quantity - excelItem.quantity) < 0.01;
                const status = quantityMatch ? 'CORRETO' : 'DIVERGENTE';
                const difference = excelItem.quantity - pdfItem.quantity;

                let observacao = '';
                if (quantityMatch) {
                    observacao = 'Quantidades coincidem perfeitamente';
                } else {
                    observacao = `PDF: ${pdfItem.quantity} ${pdfItem.unit} vs Excel: ${excelItem.quantity} ${excelItem.unit}`;
                }

                results.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: excelItem.quantity,
                    status: status,
                    diferenca: difference,
                    observacao: observacao,
                    similaridade: bestSimilarity
                });

                console.log(`📊 ${status}: "${pdfItem.description}" - Similaridade: ${(bestSimilarity * 100).toFixed(0)}%`);
            } else {
                // Item do PDF não encontrado no Excel
                results.push({
                    item: pdfItem.description,
                    lista_quantidade: pdfItem.quantity,
                    orcamento_quantidade: 0,
                    status: 'FALTANDO_NO_ORCAMENTO',
                    diferenca: -pdfItem.quantity,
                    observacao: 'Item não encontrado no orçamento',
                    similaridade: 0
                });

                console.log(`⚠️ FALTANDO_NO_ORCAMENTO: "${pdfItem.description}"`);
            }
        });

        // Itens do Excel que não foram encontrados no PDF
        excelItems.forEach((excelItem, index) => {
            if (!matchedExcelIndices.has(index)) {
                results.push({
                    item: excelItem.description,
                    lista_quantidade: 0,
                    orcamento_quantidade: excelItem.quantity,
                    status: 'FALTANDO_NA_LISTA',
                    diferenca: excelItem.quantity,
                    observacao: 'Item extra no orçamento (não está na lista)',
                    similaridade: 0
                });

                console.log(`📋 FALTANDO_NA_LISTA: "${excelItem.description}"`);
            }
        });

        console.log('✅ Análise concluída! Total de resultados:', results.length);
        return results;
    }

    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);

        // 1. Verificação exata
        if (s1 === s2) return 1.0;

        // 2. Uma string contém a outra
        if (s1.includes(s2) || s2.includes(s1)) return 0.9;

        // 3. Similaridade por palavras comuns
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
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^\w\s]/g, ' ') // Remove pontuação
            .replace(/\s+/g, ' ') // Espaços múltiplos para único
            .trim();
    }

    displayResults() {
        const resultsSection = document.getElementById('resultsSection');
        const summary = this.calculateSummary();

        let resultsHTML = `
            <div class="summary-cards">
                <div class="card total">
                    <h3>Total Itens</h3>
                    <div class="number">${summary.total}</div>
                </div>
                <div class="card match">
                    <h3>✅ Corretos</h3>
                    <div class="number">${summary.corretos}</div>
                </div>
                <div class="card mismatch">
                    <h3>❌ Divergentes</h3>
                    <div class="number">${summary.divergentes}</div>
                </div>
                <div class="card missing">
                    <h3>⚠️ Faltantes</h3>
                    <div class="number">${summary.faltantes}</div>
                </div>
            </div>

            <div class="analysis-info">
                <h3>📋 Relatório de Análise</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Itens na Lista (PDF):</strong> ${this.pdfItems.length}
                    </div>
                    <div class="info-item">
                        <strong>Itens no Orçamento (Excel):</strong> ${this.excelItems.length}
                    </div>
                    <div class="info-item">
                        <strong>Itens Analisados:</strong> ${summary.total}
                    </div>
                    <div class="info-item">
                        <strong>Taxa de Acerto:</strong> ${((summary.corretos / summary.total) * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            <div class="filters">
                <button class="filter-btn active" data-filter="all">Todos</button>
                <button class="filter-btn" data-filter="CORRETO">✅ Corretos</button>
                <button class="filter-btn" data-filter="DIVERGENTE">❌ Divergentes</button>
                <button class="filter-btn" data-filter="FALTANDO">⚠️ Faltantes</button>
            </div>

            <div class="table-container">
                <table id="comparisonTable">
                    <thead>
                        <tr>
                            <th width="60">Status</th>
                            <th width="300">Item</th>
                            <th width="100">Lista (Qtd)</th>
                            <th width="100">Orçamento (Qtd)</th>
                            <th width="80">Diferença</th>
                            <th width="120">Similaridade</th>
                            <th width="200">Observação</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.results.forEach(item => {
            const statusClass = this.getStatusClass(item.status);
            const statusIcon = this.getStatusIcon(item.status);
            const differenceClass = item.diferenca > 0 ? 'difference-positive' : 
                                  item.diferenca < 0 ? 'difference-negative' : '';
            const similarityClass = item.similaridade >= 0.8 ? 'similarity-high' : 
                                  item.similaridade >= 0.5 ? 'similarity-medium' : 'similarity-low';

            resultsHTML += `
                <tr>
                    <td class="${statusClass}">${statusIcon}</td>
                    <td title="${item.item}">${this.truncateText(item.item, 50)}</td>
                    <td>${item.lista_quantidade || 0}</td>
                    <td>${item.orcamento_quantidade || 0}</td>
                    <td class="${differenceClass}">${item.diferenca > 0 ? '+' : ''}${item.diferenca}</td>
                    <td class="${similarityClass}">${(item.similaridade * 100).toFixed(0)}%</td>
                    <td>${item.observacao}</td>
                </tr>
            `;
        });

        resultsHTML += `
                    </tbody>
                </table>
            </div>

            <div class="actions">
                <button id="exportResultsBtn" class="export-btn">📥 Exportar Resultados</button>
                <button id="showDetailsBtn" class="details-btn">🔍 Ver Detalhes da Análise</button>
            </div>
        `;

        resultsSection.innerHTML = resultsHTML;
        resultsSection.style.display = 'block';

        // Agora sim adicionamos os event listeners para os elementos recém-criados
        this.bindDynamicEvents();

        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        console.log('🎉 Resultados exibidos com sucesso!');
    }

    bindDynamicEvents() {
        // Adiciona event listeners para elementos criados dinamicamente
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                this.filterTable(filter);
            });
        });

        document.getElementById('exportResultsBtn').addEventListener('click', () => this.exportResults());
        document.getElementById('showDetailsBtn').addEventListener('click', () => this.showAnalysisDetails());
    }

    calculateSummary() {
        return {
            total: this.results.length,
            corretos: this.results.filter(r => r.status === 'CORRETO').length,
            divergentes: this.results.filter(r => r.status === 'DIVERGENTE').length,
            faltantes: this.results.filter(r => r.status.includes('FALTANDO')).length
        };
    }

    getStatusClass(status) {
        const classes = {
            'CORRETO': 'status-match',
            'DIVERGENTE': 'status-mismatch',
            'FALTANDO_NO_ORCAMENTO': 'status-missing',
            'FALTANDO_NA_LISTA': 'status-extra'
        };
        return classes[status] || '';
    }

    getStatusIcon(status) {
        const icons = {
            'CORRETO': '✅',
            'DIVERGENTE': '❌',
            'FALTANDO_NO_ORCAMENTO': '⚠️',
            'FALTANDO_NA_LISTA': '📋'
        };
        return icons[status] || '🔍';
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    filterTable(filter) {
        const rows = document.querySelectorAll('#comparisonTable tbody tr');
        
        rows.forEach(row => {
            const statusCell = row.cells[0];
            const statusIcon = statusCell.textContent.trim();
            
            let showRow = false;
            
            switch (filter) {
                case 'all':
                    showRow = true;
                    break;
                case 'CORRETO':
                    showRow = statusIcon === '✅';
                    break;
                case 'DIVERGENTE':
                    showRow = statusIcon === '❌';
                    break;
                case 'FALTANDO':
                    showRow = statusIcon === '⚠️' || statusIcon === '📋';
                    break;
            }
            
            row.style.display = showRow ? '' : 'none';
        });
    }

    exportResults() {
        const analysisData = {
            resumo: this.calculateSummary(),
            comparacao: this.results,
            metadados: {
                data_analise: new Date().toISOString(),
                total_pdf: this.pdfItems.length,
                total_excel: this.excelItems.length
            }
        };

        const dataStr = JSON.stringify(analysisData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `analise_${new Date().getTime()}.json`;
        link.click();
        
        console.log('💾 Resultados exportados!');
    }

    showAnalysisDetails() {
        const problemas = this.results.filter(r => r.status !== 'CORRETO');
        
        let details = `📊 DETALHES DA ANÁLISE\n\n`;
        details += `• Itens na lista (PDF): ${this.pdfItems.length}\n`;
        details += `• Itens no orçamento (Excel): ${this.excelItems.length}\n`;
        details += `• Total de comparações: ${this.results.length}\n`;
        details += `• Itens corretos: ${this.results.filter(r => r.status === 'CORRETO').length}\n`;
        details += `• Problemas encontrados: ${problemas.length}\n\n`;
        
        if (problemas.length > 0) {
            details += `🔍 ITENS QUE PRECISAM DE ATENÇÃO:\n\n`;
            
            problemas.forEach((item, index) => {
                details += `${index + 1}. ${this.getStatusIcon(item.status)} ${item.item}\n`;
                details += `   📏 Lista: ${item.lista_quantidade} | Orçamento: ${item.orcamento_quantidade}\n`;
                details += `   📊 Diferença: ${item.diferenca > 0 ? '+' : ''}${item.diferenca}\n`;
                details += `   💬 ${item.observacao}\n\n`;
            });

            details += `💡 AÇÕES RECOMENDADAS:\n\n`;
            details += `1. ❌ DIVERGENTES: Ajuste as quantidades no orçamento\n`;
            details += `2. ⚠️ FALTANDO_NO_ORCAMENTO: Adicione os itens faltantes\n`;
            details += `3. 📋 FALTANDO_NA_LISTA: Verifique se são itens extras necessários\n`;
        } else {
            details += `🎉 TODOS OS ITENS ESTÃO CORRETOS! Parabéns!`;
        }

        alert(details);
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('analyzeBtn').disabled = show;
    }
}

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    new SmartComparator();
    console.log('🚀 Comparador Inteligente inicializado!');
});
