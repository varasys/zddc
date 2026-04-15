# ZDDC Pandoc Tools

A collection of tools for converting Markdown documents to HTML with a professional viewer interface, optimized for technical documentation and engineering documents.

## Features

### Document Conversion (`convert`)
- **Batch processing**: Convert multiple Markdown files at once
- **Force overwrite**: `-f` flag to overwrite existing output files
- **Custom output directory**: `-o` flag to specify output location
- **Configuration-driven**: Uses `zddc.conf` for project-specific settings
- **Template integration**: Automatically applies the viewer template
- **Progress tracking**: Real-time conversion status and summary

### Professional Viewer Template (`viewer-template.html`)
- **Modern responsive design**: Works on desktop, tablet, and mobile
- **Table of Contents (TOC)**: Auto-generated sidebar navigation with smooth scrolling
- **Print optimization**: Professional formatting for PDF generation
  - Page break controls for tables
  - Repeating table headers
  - Proper page numbering
  - Clean print layout
- **URL hash navigation**: Shareable links to specific document sections
- **Mobile-friendly**: Collapsible sidebar and touch-optimized interface
- **Professional styling**: Clean typography optimized for technical documents

## Usage

### Basic Conversion
```bash
# Convert all Markdown files in current directory
./convert *.md

# Convert with force overwrite
./convert -f *.md

# Convert to specific output directory
./convert -o rendered/ *.md

# Combine flags
./convert -f -o rendered/ *.md
```

### Configuration (`zddc.conf`)
Create a `zddc.conf` file in your project directory:
```ini
# Project metadata
title = "Project Documentation"
author = "Your Organization"
date = "2024"

# Template settings
template = "/path/to/viewer-template.html"
css = "custom-styles.css"

# Output settings
output_dir = "rendered"
```

### Directory Structure
```
your-project/
├── zddc.conf              # Configuration file
├── document1.md           # Source Markdown files
├── document2.md
└── rendered/              # Generated HTML files
    ├── document1.html
    └── document2.html
```

## Template Features

### Navigation
- **TOC Generation**: Automatically creates navigation from document headings
- **Smooth Scrolling**: Click TOC items for smooth navigation to sections
- **Hash URLs**: Address bar updates with section anchors for sharing
- **Mobile Menu**: Collapsible sidebar for mobile devices

### Print Styling
- **Page Breaks**: Tables won't split across pages
- **Header Repetition**: Table headers repeat on each page
- **Professional Layout**: Optimized margins and typography
- **Page Numbers**: Sequential page numbering in footer

### Responsive Design
- **Desktop**: Full sidebar with TOC always visible
- **Tablet**: Collapsible sidebar with overlay
- **Mobile**: Hamburger menu with full-screen TOC overlay

## Advanced Usage

### Custom Templates
You can customize the viewer template by:
1. Copying `viewer-template.html` to your project
2. Modifying the CSS and HTML structure
3. Updating `zddc.conf` to point to your custom template

### Batch Processing
For large document sets:
```bash
# Process all markdown files recursively
find . -name "*.md" -exec ./convert -f -o rendered/ {} +

# Process specific document types
./convert -f -o rendered/ *-SOW-*.md *-DBD-*.md
```

### Integration with Build Systems
The convert tool returns proper exit codes and can be integrated into CI/CD pipelines:
```bash
# In a build script
if ./convert -f -o dist/ *.md; then
    echo "Documentation built successfully"
else
    echo "Documentation build failed"
    exit 1
fi
```

## File Types Supported

- **Input**: Markdown (`.md`) files with pandoc extensions
- **Output**: HTML files with embedded CSS and JavaScript
- **Images**: Supports embedded images and diagrams
- **Tables**: Full table support with print optimization
- **Code**: Syntax highlighting for code blocks

## Dependencies

- **pandoc**: Document conversion engine
- **Modern browser**: For viewing generated HTML files
- **Optional**: Web server for serving files (prevents CORS issues)

## Troubleshooting

### Common Issues
1. **Template not found**: Ensure `zddc.conf` points to correct template path
2. **Permission errors**: Make sure `convert` script is executable (`chmod +x convert`)
3. **Missing output**: Check that output directory exists or use `-o` to create it
4. **Print issues**: Use "Print to PDF" in browser for best results

### Performance
- Large documents (>1000 pages) may take longer to render
- Consider splitting very large documents into sections
- Use batch processing for multiple files

## Examples

### Engineering Documentation
Perfect for:
- Design basis documents
- Specifications and standards
- Project requirements
- Technical procedures
- Quality documentation

### Features Optimized For
- **Professional appearance**: Clean, corporate styling
- **Technical content**: Tables, diagrams, code blocks
- **Print output**: PDF generation with proper formatting
- **Navigation**: Easy browsing of long documents
- **Sharing**: URL fragments for referencing specific sections
