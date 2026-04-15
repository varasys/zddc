/**
 * YAML front matter parsing and stringification
 */

/**
 * Parse YAML front matter from markdown content
 * @param {string} content - Full markdown content with potential front matter
 * @returns {{data: Object, content: string}} Parsed front matter data and remaining content
 */
function parseFrontMatter(content) {
    if (!content || !content.startsWith('---\n')) {
        return {
            data: {},
            content: content || ''
        };
    }
    
    const endMatch = content.indexOf('\n---\n', 4);
    if (endMatch === -1) {
        return {
            data: {},
            content: content
        };
    }
    
    const frontMatterText = content.substring(4, endMatch);
    const markdownBody = content.substring(endMatch + 5);
    
    // Parse YAML front matter (basic key: value parsing)
    const frontMatterData = {};
    const lines = frontMatterText.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmedLine.substring(0, colonIndex).trim();
            let value = trimmedLine.substring(colonIndex + 1).trim();
            
            // Remove quotes
            value = value.replace(/^["']|["']$/g, '');
            
            // Handle arrays (basic support for [item1, item2])
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
            }
            
            frontMatterData[key] = value;
        }
    }
    
    return {
        data: frontMatterData,
        content: markdownBody
    };
}

/**
 * Stringify front matter data and combine with markdown content
 * @param {string} content - Markdown content
 * @param {Object} data - Front matter data object
 * @returns {string} Combined YAML front matter and markdown
 */
function stringifyFrontMatter(content, data) {
    if (!data || Object.keys(data).length === 0) {
        return content;
    }
    
    let yamlString = '---\n';
    
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
            yamlString += `${key}: [${value.map(v => `"${v}"`).join(', ')}]\n`;
        } else {
            yamlString += `${key}: "${value}"\n`;
        }
    }
    
    yamlString += '---\n';
    
    return yamlString + content;
}

/**
 * Convert front matter data to YAML string for textarea display (without delimiters)
 * @param {Object} data - Front matter data
 * @returns {string} YAML string for textarea
 */
function stringifyFrontMatterToTextarea(data) {
    if (!data || Object.keys(data).length === 0) {
        return '';
    }
    
    let yamlString = '';
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
            yamlString += `${key}: [${value.map(v => `"${v}"`).join(', ')}]\n`;
        } else {
            yamlString += `${key}: "${value}"\n`;
        }
    }
    
    return yamlString.trim();
}
