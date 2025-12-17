const config = require('../config');
const usecases = require('./usecases');
const fs = require('fs').promises;
const path = require('path');

// AWS S3 client - cached per region
const s3Clients = {};

function getS3Client(region = 'us-west-2') {
    if (!s3Clients[region]) {
        const { S3Client } = require('@aws-sdk/client-s3');
        // Uses default credential chain (ECS Task Role, env vars, etc.)
        s3Clients[region] = new S3Client({ region });
        console.log(`Created S3 client for region: ${region}`);
    }
    return s3Clients[region];
}

// Parse S3 URL to extract bucket, key, and region
// Supports: s3://bucket/key, https://bucket.s3.region.amazonaws.com/key, https://bucket.s3.amazonaws.com/key
function parseS3Url(url) {
    // s3:// protocol - no region info, will use S3_REGION env var (preferred) or AWS_REGION
    if (url.startsWith('s3://')) {
        const withoutProtocol = url.slice(5);
        const slashIndex = withoutProtocol.indexOf('/');
        const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-west-2';
        if (slashIndex === -1) {
            return { bucket: withoutProtocol, key: '', region };
        }
        return {
            bucket: withoutProtocol.slice(0, slashIndex),
            key: withoutProtocol.slice(slashIndex + 1),
            region
        };
    }
    
    // https://bucket.s3.region.amazonaws.com/key or https://bucket.s3-region.amazonaws.com/key
    const bucketStyleMatch = url.match(/^https?:\/\/([^.]+)\.s3[.-]([^.]+)\.amazonaws\.com\/?(.*)$/);
    if (bucketStyleMatch) {
        return {
            bucket: bucketStyleMatch[1],
            region: bucketStyleMatch[2],
            key: bucketStyleMatch[3] || ''
        };
    }
    
    // https://bucket.s3.amazonaws.com/key (no region, us-west-2 default)
    const bucketStyleNoRegionMatch = url.match(/^https?:\/\/([^.]+)\.s3\.amazonaws\.com\/?(.*)$/);
    if (bucketStyleNoRegionMatch) {
        return {
            bucket: bucketStyleNoRegionMatch[1],
            region: 'us-west-2',
            key: bucketStyleNoRegionMatch[2] || ''
        };
    }
    
    // https://s3.region.amazonaws.com/bucket/key
    const pathStyleMatch = url.match(/^https?:\/\/s3[.-]([^.]+)\.amazonaws\.com\/([^/]+)\/?(.*)$/);
    if (pathStyleMatch) {
        return {
            region: pathStyleMatch[1],
            bucket: pathStyleMatch[2],
            key: pathStyleMatch[3] || ''
        };
    }
    
    return null;
}

function isS3Url(url) {
    return parseS3Url(url) !== null;
}

// Fetch content from S3 using SDK
async function fetchFromS3(bucket, key, region = 'us-west-2') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const client = getS3Client(region);
    
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    
    // Convert stream to string or buffer
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// List objects in S3 bucket
async function listS3Objects(bucket, prefix = '', region = 'us-west-2') {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const client = getS3Client(region);
    
    const objects = [];
    let continuationToken;
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });
        
        const response = await client.send(command);
        if (response.Contents) {
            objects.push(...response.Contents);
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    return objects;
}

// Parse S3 object listing to extract use cases and images
function parseS3ObjectListing(objects) {
    const useCaseFiles = [];
    const imageFiles = [];
    
    for (const obj of objects) {
        const key = obj.Key;
        
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

// Parse S3 bucket listing XML to extract use cases and images (HTTP fallback)
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
    const s3Info = parseS3Url(repoUrl);
    
    // Try S3 SDK first if it's an S3 URL
    if (s3Info) {
        console.log(`Using S3 SDK for bucket: ${s3Info.bucket} in region: ${s3Info.region}`);
        
        // First try manifest.json via S3
        try {
            const manifestKey = s3Info.key ? `${s3Info.key}/manifest.json` : 'manifest.json';
            const data = await fetchFromS3(s3Info.bucket, manifestKey, s3Info.region);
            return JSON.parse(data.toString('utf-8'));
        } catch (e) {
            console.log('No manifest.json found in S3, listing bucket...');
        }
        
        // Fallback: list S3 bucket objects
        try {
            const objects = await listS3Objects(s3Info.bucket, s3Info.key, s3Info.region);
            console.log(`Found ${objects.length} objects in S3 bucket`);
            return parseS3ObjectListing(objects);
        } catch (e) {
            console.error('S3 SDK error:', e.message);
            // Fall through to HTTP method
        }
    }
    
    // HTTP method (original behavior)
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
        console.log('No manifest.json found via HTTP, trying S3 bucket listing...');
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
    const s3Info = parseS3Url(repoUrl);
    
    let mdContent, yamlContent;
    
    if (s3Info) {
        // Use S3 SDK
        const baseKey = s3Info.key ? `${s3Info.key}/` : '';
        const mdKey = `${baseKey}${productCategory}/${slug}.md`;
        const yamlKey = `${baseKey}${productCategory}/${slug}.yaml`;
        
        const [mdBuffer, yamlBuffer] = await Promise.all([
            fetchFromS3(s3Info.bucket, mdKey, s3Info.region),
            fetchFromS3(s3Info.bucket, yamlKey, s3Info.region)
        ]);
        
        mdContent = mdBuffer.toString('utf-8');
        yamlContent = yamlBuffer.toString('utf-8');
    } else {
        // Use HTTP fetch
        const mdUrl = `${repoUrl}/${productCategory}/${slug}.md`;
        const yamlUrl = `${repoUrl}/${productCategory}/${slug}.yaml`;
        
        const [mdResponse, yamlResponse] = await Promise.all([
            fetch(mdUrl),
            fetch(yamlUrl)
        ]);
        
        if (!mdResponse.ok || !yamlResponse.ok) {
            throw new Error(`Failed to download use case files for ${productCategory}/${slug}`);
        }
        
        mdContent = await mdResponse.text();
        yamlContent = await yamlResponse.text();
    }
    
    await usecases.saveToLocal(productCategory, slug, mdContent, yamlContent);
    
    console.log(`Downloaded use case: ${productCategory}/${slug}`);
    return true;
}

async function downloadImage(repoUrl, imagePath) {
    const useCasesDir = usecases.getUseCasesDir();
    const localPath = path.join(useCasesDir, imagePath);
    
    try {
        let buffer;
        const s3Info = parseS3Url(repoUrl);
        
        if (s3Info) {
            // Use S3 SDK
            const imageKey = s3Info.key ? `${s3Info.key}/${imagePath}` : imagePath;
            buffer = await fetchFromS3(s3Info.bucket, imageKey, s3Info.region);
        } else {
            // Use HTTP fetch
            const imageUrl = `${repoUrl}/${imagePath}`;
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            buffer = Buffer.from(await response.arrayBuffer());
        }
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, buffer);
        
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
    downloadAll,
    // Export for testing
    parseS3Url,
    isS3Url
};