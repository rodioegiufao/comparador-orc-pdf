// script.js - Sistema usando ChatGPT como motor de análise
class ChatGPTComparator {
    constructor() {
        this.pdfText = '';
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
        document.getElementById('analyzeBtn').addEventListener('click', () => this.prepareAnalysis());
        document.getElementById('copyPromptBtn').addEventListener('click', () => this.copyPrompt());
        document.getElementById('processResponseBtn').addEventListener('click', () => this.processGPTResponse());
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const previewElement = document.getElementById(`${type}Preview`);
        previewElement.innerHTML = `<p><strong>${file.name}</strong> - Processando...</p>`;

        this.showLoading(true);

        try {
            if (type === 'pdf') {
                this.pdfText = await this.extractPDFText(file);
                previewElement.innerHTML = `<p><strong>${file.name}</strong> ✅</p>`;
            } else {
                this.excelData = await this.extractExcelData(file);
                previewElement.innerHTML = `<p><strong>${file.name}</strong> ✅</p>`;
            }
        } catch (error) {
            console.error(`Erro ao processar ${type}:`, error);
            previewElement.innerHTML = `<p><strong>${file.name}</strong> ❌ Erro</p>`;
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

    checkFilesReady() {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = !(this.pdfText && this.excelData.length > 0);
    }

    prepareAnalysis() {
        // Prepara o prompt para o ChatGPT
        const prompt = this.createAnalysisPrompt();
        document.getElementById('analysisPrompt').value = prompt;
        
        // Mostra as seções de prompt e resposta
        document.getElementById('promptSection').style.display = 'block';
        document.getElementById('responseSection').style.display = 'block';
        
        // Scroll para a seção de prompt
        document.getElementById('promptSection').scrollIntoView({ behavior: 'smooth' });
    }

    createAnalysisPrompt() {
        const excelSample = this.excelData.slice(0, 10).map(row => row.join(' | ')).join('\n');
        const pdfSample = this.pdfText.substring(0, 1500) + (this.pdfText.length > 1500 ? '...' : '');

        return `ANÁLISE DE COMPARAÇÃO ENTRE LISTA DE MATERIAIS E ORÇAMENTO

POR FAVOR, ANALISE OS DADOS ABAIXO E IDENTIFIQUE:

1. Itens que estão em AMBOS os arquivos com quantidades CORRETAS
2. Itens que estão em AMBOS mas com quantidades DIFERENTES
3. Itens que estão apenas na LISTA DE MATERIAIS (PDF)
4. Itens que estão apenas no ORÇAMENTO (Excel)

RETORNE APENAS UM JSON NO SEGUINTE FORMATO:
{
  "comparison": [
    {
      "item": "Nome do item",
      "lista_quantidade": 100,
      "orcamento_quantidade": 100,
      "status": "CORRETO" | "DIVERGENTE" | "FALTANDO_NO_ORCAMENTO" | "FALTANDO_NA_LISTA",
      "diferenca": 0,
      "observacao": "Descrição detalhada"
    }
  ],
  "resumo": {
    "total_itens": 50,
    "corretos": 30,
    "divergentes": 15,
    "faltando_orcamento": 3,
    "faltando_lista": 2
  }
}

DADOS DA LISTA DE MATERIAIS (PDF):
\`\`\`
${pdfSample}
\`\`\`

DADOS DO ORÇAMENTO (Excel - primeiras linhas):
\`\`\`
${excelSample}
\`\`\`

INSTRUÇÕES IMPORTANTES:
- Compare os itens por similaridade de descrição
- Considere variações de nomenclatura (ex: "CABO 3X1,5MM" = "CABO ISOLADO 3X1,5MM²")
- Ignore cabeçalhos e textos explicativos
- Foque apenas em itens com quantidades numéricas

RETORNE APENAS O JSON, SEM EXPLICAÇÕES ADICIONAIS.`;
    }

    copyPrompt() {
        const promptText = document.getElementById('analysisPrompt');
        promptText.select();
        document.execCommand('copy');
        
        // Feedback visual
        const btn = document.getElementById('copyPromptBtn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copiado!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }

    processGPTResponse() {
        const responseText = document.getElementById('chatgptResponse').value.trim();
        
        if (!responseText) {
            alert('Por favor, cole a resposta do ChatGPT primeiro');
            return;
        }

        this.showLoading(true);

        try {
            // Tenta extrair JSON da resposta
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Não foi possível encontrar JSON na resposta');
            }

            const analysisResult = JSON.parse(jsonMatch[0]);
            this.displayResults(analysisResult);
            
        } catch (error) {
            console.error('Erro ao processar resposta:', error);
            alert('Erro ao processar resposta do ChatGPT. Verifique se a resposta contém um JSON válido.');
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(analysisResult) {
        const resultsSection = document.getElementById('resultsSection');
        
        // Cria o HTML dos resultados
        let resultsHTML = `
            <div class="summary-cards">
                <div class="card total">
                    <h3>Total Itens</h3>
                    <div class="number">${analysisResult.resumo.total_itens || 0}</div>
                </div>
                <div class="card match">
                    <h3>✅ Corretos</h3>
                    <div class="number">${analysisResult.resumo.corretos || 0}</div>
                </div>
                <div class="card mismatch">
                    <h3>❌ Divergentes</h3>
                    <div class="number">${analysisResult.resumo.divergentes || 0}</div>
                </div>
                <div class="card missing">
                    <h3>⚠️ Faltantes</h3>
                    <div class="number">${(analysisResult.resumo.faltando_orcamento || 0) + (analysisResult.resumo.faltando_lista || 0)}</div>
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
                            <th width="50">Status</th>
                            <th width="350">Item</th>
                            <th width="120">Lista (Qtd)</th>
                            <th width="120">Orçamento (Qtd)</th>
                            <th width="100">Diferença</th>
                            <th width="200">Observação</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Adiciona cada item na tabela
        analysisResult.comparison.forEach(item => {
            const statusClass = this.getStatusClass(item.status);
            const statusIcon = this.getStatusIcon(item.status);
            const differenceClass = item.diferenca > 0 ? 'difference-positive' : 'difference-negative';
            
            resultsHTML += `
                <tr>
                    <td class="${statusClass}">${statusIcon} ${this.getStatusText(item.status)}</td>
                    <td>${item.item}</td>
                    <td>${item.lista_quantidade || 0}</td>
                    <td>${item.orcamento_quantidade || 0}</td>
                    <td class="${differenceClass}">${item.diferenca > 0 ? '+' : ''}${item.diferenca}</td>
                    <td>${item.observacao || ''}</td>
                </tr>
            `;
        });

        resultsHTML += `
                    </tbody>
                </table>
            </div>

            <div class="export-section">
                <button id="exportResultsBtn" class="export-btn">📥 Exportar Resultados</button>
            </div>
        `;

        resultsSection.innerHTML = resultsHTML;
        resultsSection.style.display = 'block';

        // Adiciona event listeners aos filtros
        this.bindFilterEvents();
        document.getElementById('exportResultsBtn').addEventListener('click', () => this.exportResults(analysisResult));

        // Scroll para resultados
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    getStatusClass(status) {
        const classes = {
            'CORRETO': 'status-match',
            'DIVERGENTE': 'status-mismatch',
            'FALTANDO_NO_ORCAMENTO': 'status-missing',
            'FALTANDO_NA_LISTA': 'status-missing'
        };
        return classes[status] || 'status-unknown';
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

    getStatusText(status) {
        const texts = {
            'CORRETO': 'Correto',
            'DIVERGENTE': 'Divergente',
            'FALTANDO_NO_ORCAMENTO': 'Faltante',
            'FALTANDO_NA_LISTA': 'Extra'
        };
        return texts[status] || status;
    }

    bindFilterEvents() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                
                // Atualiza botões ativos
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Filtra a tabela
                this.filterTable(filter);
            });
        });
    }

    filterTable(filter) {
        const rows = document.querySelectorAll('#comparisonTable tbody tr');
        
        rows.forEach(row => {
            const statusCell = row.cells[0];
            const statusText = statusCell.textContent.trim();
            
            let showRow = false;
            
            switch (filter) {
                case 'all':
                    showRow = true;
                    break;
                case 'CORRETO':
                    showRow = statusText.includes('Correto');
                    break;
                case 'DIVERGENTE':
                    showRow = statusText.includes('Divergente');
                    break;
                case 'FALTANDO':
                    showRow = statusText.includes('Faltante') || statusText.includes('Extra');
                    break;
            }
            
            row.style.display = showRow ? '' : 'none';
        });
    }

    exportResults(analysisResult) {
        const dataStr = JSON.stringify(analysisResult, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'analise_comparacao.json';
        link.click();
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }
}

// Configuração do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    new ChatGPTComparator();
});
