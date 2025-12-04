const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { marked } = require('marked');
const YAML = require('yaml');
const config = require('../config');

function getUseCasesDir() {
    return config.getUseCasePath();
}

function getCompletionFile() {
    return path.join(config.getDataPath(), 'completedUseCases.json');
}

function getFeedbackFile() {
    return path.join(config.getDataPath(), 'feedback.json');
}

async function loadFromDisk(productCategory, useCaseSlug) {
    const useCasesDir = getUseCasesDir();
    const mdPath = path.join(useCasesDir, productCategory, `${useCaseSlug}.md`);
    const yamlPath = path.join(useCasesDir, productCategory, `${useCaseSlug}.yaml`);
    
    try {
        const [mdContent, yamlContent] = await Promise.all([
            fs.readFile(mdPath, 'utf8').catch(() => null),
            fs.readFile(yamlPath, 'utf8').catch(() => null)
        ]);
        
        if (!mdContent || !yamlContent) {
            return null;
        }
        
        const ucConfig = YAML.parse(yamlContent);
        const processedMd = config.replaceVariables(mdContent);
        const processedConfig = JSON.parse(config.replaceVariables(JSON.stringify(ucConfig)));
        
        return {
            id: `${productCategory}/${useCaseSlug}`,
            productCategory,
            slug: useCaseSlug,
            content: processedMd,
            html: marked(processedMd),
            ...processedConfig
        };
    } catch (error) {
        console.error(`Error loading use case ${productCategory}/${useCaseSlug}:`, error);
        return null;
    }
}

async function getAll() {
    const useCases = [];
    const conflicts = [];
    const seenSlugs = new Map();
    const useCasesDir = getUseCasesDir();
    
    try {
        // Ensure directory exists
        await fs.mkdir(useCasesDir, { recursive: true });
        
        const productCategories = await fs.readdir(useCasesDir);
        
        for (const productCategory of productCategories) {
            const categoryPath = path.join(useCasesDir, productCategory);
            const stat = await fs.stat(categoryPath);
            
            if (!stat.isDirectory()) continue;
            
            const files = await fs.readdir(categoryPath);
            const yamlFiles = files.filter(f => f.endsWith('.yaml'));
            
            for (const yamlFile of yamlFiles) {
                const slug = yamlFile.replace('.yaml', '');
                
                if (seenSlugs.has(slug)) {
                    seenSlugs.get(slug).push(productCategory);
                } else {
                    seenSlugs.set(slug, [productCategory]);
                }
                
                const useCase = await loadFromDisk(productCategory, slug);
                if (useCase) {
                    useCases.push(useCase);
                }
            }
        }
        
        // Identify conflicts
        for (const [slug, categories] of seenSlugs) {
            if (categories.length > 1) {
                conflicts.push({
                    slug,
                    productCategories: categories,
                    ids: categories.map(cat => `${cat}/${slug}`)
                });
            }
        }
        
        // Sort by product, category order, then use case order
        useCases.sort((a, b) => {
            if (a.product !== b.product) return (a.product || '').localeCompare(b.product || '');
            if (a.categoryOrder !== b.categoryOrder) return (a.categoryOrder || 0) - (b.categoryOrder || 0);
            if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
            return (a.useCaseOrder || 0) - (b.useCaseOrder || 0);
        });
        
        return { useCases, conflicts };
    } catch (error) {
        console.error('Error loading use cases:', error);
        return { useCases: [], conflicts: [] };
    }
}

async function getActive() {
    const { useCases } = await getAll();
    const cfg = config.get();
    
    // Filter out use cases where active: false in YAML
    let filtered = useCases.filter(uc => uc.active !== false);
    
    // Filter by config activeUseCases list if set
    if (cfg.activeUseCases && cfg.activeUseCases.length > 0) {
        const activeSet = new Set(cfg.activeUseCases);
        filtered = filtered.filter(uc => activeSet.has(uc.id));
    }
    
    // Apply custom order if set
    if (cfg.useCaseOrder && Object.keys(cfg.useCaseOrder).length > 0) {
        filtered.sort((a, b) => {
            const orderA = cfg.useCaseOrder[a.id] ?? Infinity;
            const orderB = cfg.useCaseOrder[b.id] ?? Infinity;
            return orderA - orderB;
        });
    }
    
    return filtered;
}

async function loadCompleted() {
    const completionFile = getCompletionFile();
    try {
        if (fsSync.existsSync(completionFile)) {
            const data = await fs.readFile(completionFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading completed use cases:', error);
    }
    return {};
}

async function saveCompleted(completed) {
    const completionFile = getCompletionFile();
    try {
        await fs.mkdir(path.dirname(completionFile), { recursive: true });
        await fs.writeFile(completionFile, JSON.stringify(completed, null, 2));
    } catch (error) {
        console.error('Error saving completed use cases:', error);
        throw error;
    }
}

async function saveFeedback(useCaseId, rating, message) {
    const feedbackFile = getFeedbackFile();
    let feedback = {};
    try {
        if (fsSync.existsSync(feedbackFile)) {
            feedback = JSON.parse(await fs.readFile(feedbackFile, 'utf8'));
        }
    } catch (e) {}
    
    if (!feedback[useCaseId]) feedback[useCaseId] = [];
    feedback[useCaseId].push({
        rating,
        message,
        timestamp: new Date().toISOString()
    });
    
    await fs.mkdir(path.dirname(feedbackFile), { recursive: true });
    await fs.writeFile(feedbackFile, JSON.stringify(feedback, null, 2));
}

async function saveToLocal(productCategory, slug, mdContent, yamlContent) {
    const useCasesDir = getUseCasesDir();
    const categoryDir = path.join(useCasesDir, productCategory);
    await fs.mkdir(categoryDir, { recursive: true });
    
    await Promise.all([
        fs.writeFile(path.join(categoryDir, `${slug}.md`), mdContent),
        fs.writeFile(path.join(categoryDir, `${slug}.yaml`), yamlContent)
    ]);
}

module.exports = {
    getUseCasesDir,
    loadFromDisk,
    getAll,
    getActive,
    loadCompleted,
    saveCompleted,
    saveFeedback,
    saveToLocal
};