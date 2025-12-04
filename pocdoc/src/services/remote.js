const config = require('../config');
const usecases = require('./usecases');
const fs = require('fs').promises;
const path = require('path');

// Parse S3 bucket listing XML to extract use cases and images
function parseS3BucketListing(xmlText) {
    const useCaseFiles = [];
    const imageFiles = [];
    
    // Extract all <Key> elements
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    let match;
    
    while ((match = keyRegex.exec(xmlText)) !== null) {
        const key = match[1];
        
        // Process .yaml files (each use case has .md and .yaml)
        if (key.endsWith('.yaml') && key.includes('/') && !key.includes('/images/')) {
            const parts = key.replace('.yaml', '').split('/');
            if (parts.length === 2) {
                const [productCategory, slug] = parts;
                useCaseFiles.push({
                    id: `${productCategory}/${slug}`,
                    name: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    version: '1.0.0'
                });
            }
        }
        
        // Process image files
        if (key.includes('/images/') && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(key)) {
            imageFiles.push(key);
        }
    }
    
    return { useCases: useCaseFiles, images: imageFiles };
}

async function fetchManifest(repoUrl) {
    // First try to fetch manifest.json
    try {
        const manifestUrl = `${repoUrl}/manifest.json`;
        const response = await fetch(manifestUrl);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await response.json();
            }
        }
    } catch (e) {
        console.log('No manifest.json found, trying S3 bucket listing...');
    }
    
    // Fallback: try to parse S3 bucket listing
    try {
        const response = await fetch(repoUrl);
        if (response.ok) {
            const text = await response.text();
            if (text.includes('<ListBucketResult') || text.includes('<Contents>')) {
                console.log('Parsing S3 bucket listing XML...');
                return parseS3BucketListing(text);
            }
        }
    } catch (e) {
        console.log('Failed to parse S3 listing:', e.message);
    }
    
    throw new Error('Could not fetch manifest.json or parse S3 bucket listing from repository');
}

async function checkForUpdates(repoUrl) {
    const cfg = config.get();
    const url = repoUrl || cfg.useCaseRepoUrl;
    
    if (!url) {
        return { newUseCases: [], updated: [], totalInManifest: 0 };
    }
    
    try {
        const manifest = await fetchManifest(url);
        const { useCases: localUseCases } = await usecases.getAll();
        const remoteUseCases = manifest.useCases || [];
        
        const newUseCases = [];
        const updated = [];
        
        for (const remoteUc of remoteUseCases) {
            const localUc = localUseCases.find(l => l.id === remoteUc.id);
            
            if (!localUc) {
                newUseCases.push(remoteUc);
            } else if (remoteUc.version && localUc.version && remoteUc.version !== localUc.version) {
                updated.push({
                    ...remoteUc,
                    localVersion: localUc.version
                });
            }
        }
        
        return { 
            newUseCases, 
            updated, 
            totalInManifest: remoteUseCases.length,
            imageCount: manifest.images?.length || 0
        };
    } catch (error) {
        console.error('Error fetching remote use cases:', error);
        return { newUseCases: [], updated: [], totalInManifest: 0, error: error.message };
    }
}

async function downloadUseCase(repoUrl, productCategory, slug) {
    const mdUrl = `${repoUrl}/${productCategory}/${slug}.md`;
    const yamlUrl = `${repoUrl}/${productCategory}/${slug}.yaml`;
    
    const [mdResponse, yamlResponse] = await Promise.all([
        fetch(mdUrl),
        fetch(yamlUrl)
    ]);
    
    if (!mdResponse.ok || !yamlResponse.ok) {
        throw new Error(`Failed to download use case files for ${productCategory}/${slug}`);
    }
    
    const mdContent = await mdResponse.text();
    const yamlContent = await yamlResponse.text();
    
    await usecases.saveToLocal(productCategory, slug, mdContent, yamlContent);
    
    console.log(`Downloaded use case: ${productCategory}/${slug}`);
    return true;
}

async function downloadImage(repoUrl, imagePath) {
    const imageUrl = `${repoUrl}/${imagePath}`;
    const useCasesDir = usecases.getUseCasesDir();
    const localPath = path.join(useCasesDir, imagePath);
    
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        
        // Download as binary
        const buffer = await response.arrayBuffer();
        await fs.writeFile(localPath, Buffer.from(buffer));
        
        console.log(`Downloaded image: ${imagePath}`);
        return true;
    } catch (err) {
        console.error(`Failed to download image ${imagePath}:`, err.message);
        return false;
    }
}

async function downloadAll(repoUrl, progressCallback) {
    const manifest = await fetchManifest(repoUrl);
    const useCasesToDownload = manifest.useCases || [];
    const imagesToDownload = manifest.images || [];
    
    const totalItems = useCasesToDownload.length + imagesToDownload.length;
    
    if (totalItems === 0) {
        throw new Error('No use cases found in manifest');
    }
    
    let downloaded = 0;
    let failed = 0;
    let currentItem = 0;
    
    // Download use cases
    for (const uc of useCasesToDownload) {
        const [productCategory, slug] = uc.id.split('/');
        
        try {
            await downloadUseCase(repoUrl, productCategory, slug);
            downloaded++;
        } catch (err) {
            failed++;
            console.error(`Error downloading ${uc.id}:`, err.message);
        }
        
        currentItem++;
        if (progressCallback) {
            const progress = Math.round(10 + (currentItem / totalItems) * 85);
            progressCallback({
                progress,
                current: currentItem,
                total: totalItems,
                name: uc.name || uc.id
            });
        }
    }
    
    // Download images
    for (const imagePath of imagesToDownload) {
        const success = await downloadImage(repoUrl, imagePath);
        if (success) {
            downloaded++;
        } else {
            failed++;
        }
        
        currentItem++;
        if (progressCallback) {
            const progress = Math.round(10 + (currentItem / totalItems) * 85);
            const imageName = path.basename(imagePath);
            progressCallback({
                progress,
                current: currentItem,
                total: totalItems,
                name: `Image: ${imageName}`
            });
        }
    }
    
    return { 
        downloaded, 
        failed, 
        total: totalItems,
        useCases: useCasesToDownload.length,
        images: imagesToDownload.length
    };
}

module.exports = {
    fetchManifest,
    checkForUpdates,
    downloadUseCase,
    downloadImage,
    downloadAll
};