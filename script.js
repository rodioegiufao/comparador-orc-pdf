// script.js - Versão simplificada e funcional
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
        // Eventos de upload de arquivos
        document.getElementById('pdfFile').addEventListener('change', (e) => this.handleFileUpload(e, 'pdf'));
        document.getElementById('excelFile').addEventListener('change', (e) => this.handleFileUpload(e, 'excel'));
        
        // Botão comparar
        document.getElementById('compareBtn').addEventListener('click', () => this.compareFiles());
        
        // Filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterTable(e.target.dataset.filter));
        });
        
        // Exportar
        document.getElementById('exportBtn').addEventListener('click', () => this.exportResults());
    }

    handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const previewElement = document.getElementById(`${type}Preview`);
        const infoElement = document.getElementById(`${type}Info`);
        
        previewElement.innerHTML = `<p><strong>${file.name}</strong></p>`;
        infoElement.textContent = `Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB`;

        if (type === 'pdf') {
            this.pdfFile = file;
        } else {
            this.excelFile = file;
        }

        this.checkFilesReady();
    }

    checkFilesReady() {
        const btn = document.getElementById('compareBtn');
        btn.disabled = !(this.pdfFile && this.excelFile);
    }

    async compareFiles() {
        this.showLoading(true);
        
        try {
            // Simula processamento (substituir pela lógica real)
            await this.simulateProcessing();
            
            // Gera resultados de exemplo
            this.generateSampleResults();
            
            this.displayResults();
        } catch (error) {
            console.error('Erro na comparação:', error);
            alert('Erro ao processar arquivos: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async simulateProcessing() {
        // Simula tempo de processamento
        return new Promise(resolve => setTimeout(resolve, 2000));
    }

    generateSampleResults() {
        // Dados de exemplo baseados nos seus arquivos
        this.results = [
            {
                description: "CABO ISOLADO PP 3 X 1,5 MM2",
                pdfQuantity: 312.4,
                excelQuantity: 312.4,
                pdfUnit: "m",
                excelUnit: "m",
                status: "match",
                similarity: 0.95,
                difference: 0
            },
            {
                description: "ELETRODUTO FLEXÍVEL CORRUGADO 3/4\"",
                pdfQuantity: 82.9,
                excelQuantity: 82.9,
                pdfUnit: "m",
                excelUnit: "m",
                status: "match",
                similarity: 0.92,
                difference: 0
            },
            {
                description: "CAIXA DE PASSAGEM PVC 4X2\"",
                pdfQuantity: 21,
                excelQuantity: 21,
                pdfUnit: "un",
                excelUnit: "un",
                status: "match",
                similarity: 0.98,
                difference: 0
            },
            {
                description: "PLUGUE FÊMEA LUMINARIA LED",
                pdfQuantity: 268,
                excelQuantity: 250,
                pdfUnit: "un",
                excelUnit: "un",
                status: "mismatch",
                similarity: 0.96,
                difference: -18
            },
            {
                description: "TOMADA DE PISO 4X4 LATÃO",
                pdfQuantity: 51,
                excelQuantity: 0,
                pdfUnit: "un",
                excelUnit: "un",
                status: "missing",
                similarity: 0,
                difference: -51
            },
            {
                description: "TALA PLANA PERFURADA 38mm",
                pdfQuantity: 348,
                excelQuantity: 0,
                pdfUnit: "pç",
                excelUnit: "pç",
                status: "missing",
                similarity: 0,
                difference: -348
            },
            {
                description: "ITEM EXTRA NO ORÇAMENTO",
                pdfQuantity: 0,
                excelQuantity: 10,
                pdfUnit: "un",
                excelUnit: "un",
                status: "extra",
                similarity: 0,
                difference: 10
            }
        ];
    }

    displayResults() {
        this.updateSummary();
        this.updateTable();
        document.getElementById('resultsSection').style.display = 'block';
        
        // Scroll para resultados
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
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
                    ${this.getStatusIcon(item.status)} ${item.status}
                </td>
                <td>${item.description}</td>
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

    getSimilarityClass(similarity) {
        if (similarity >= 0.8) return 'similarity-high';
        if (similarity >= 0.5) return 'similarity-medium';
        return 'similarity-low';
    }

    filterTable(filter) {
        // Atualiza botões ativos
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.updateTable(filter);
    }

    exportResults() {
        // Simula exportação
        const dataStr = JSON.stringify(this.results, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'resultados-comparacao.json';
        link.click();
        
        alert('Resultados exportados com sucesso!');
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('compareBtn').disabled = show;
    }
}

// Inicializa a aplicação quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new MaterialComparator();
});