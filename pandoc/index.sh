#!/bin/bash

# Script to create symlinks and markdown table for ZDDC files
# Usage: ./index.sh [-o output_dir] <folder1> [folder2] [...]
# 
# Creates three types of symlinks in output directory:
# 1. Full filename symlink
# 2. trackingNumber.ext (latest revision)  
# 3. trackingNumber_revision.ext (specific revision)
# 
# Also generates index.html in each input folder with summary table
# CSS and title can be customized via YAML frontmatter in existing index.md files

set -e

# Default output directory
OUTPUT_DIR=".archive"

# Parse command line options
while getopts "o:" opt; do
    case $opt in
        o)
            OUTPUT_DIR="$OPTARG"
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            echo "Usage: $0 [-o output_dir] <folder1> [folder2] [...]"
            exit 1
            ;;
    esac
done

# Shift past the options
shift $((OPTIND-1))

# Check if at least one folder is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 [-o output_dir] <folder1> [folder2] [...]"
    echo "Creates symlinks and markdown table for ZDDC files"
    echo "Options:"
    echo "  -o output_dir    Output directory (default: .archive)"
    exit 1
fi

# Validate all input directories exist
for folder in "$@"; do
    if [ ! -d "$folder" ]; then
        echo "Error: Directory '$folder' does not exist"
        exit 1
    fi
done

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to get revision from symlink target filename
get_revision_from_target() {
    local target="$1"
    local basename_target=$(basename "$target")
    
    # Parse ZDDC filename to extract revision
    if [[ "$basename_target" =~ ^([^_]+)_([^\ ]+)\ +\(([^\)]+)\)\ *-\ *(.+)\.([^.]+)$ ]]; then
        echo "${BASH_REMATCH[2]}"
    fi
}

# Function to check if revision A is greater than revision B
is_revision_greater() {
    local rev_a="$1"
    local rev_b="$2"
    
    # Remove tilde prefix for comparison
    local clean_a="${rev_a#~}"
    local clean_b="${rev_b#~}"
    
    # Use version sort to compare
    [ "$(printf '%s\n%s\n' "$clean_b" "$clean_a" | sort -V | tail -n1)" = "$clean_a" ] && [ "$clean_a" != "$clean_b" ]
}

echo "Processing ZDDC files from folders: $*"
echo "Output directory: $OUTPUT_DIR"


# Process each folder individually
for folder in "$@"; do
    echo "Processing folder: $folder"
    
    # Track latest revisions for each tracking number (per folder)
    declare -A latest_files
    
    # Sequential counter for table rows (per folder)
    row_counter=0
    
    # Set title for this folder
    title="Document Index - $(basename "$folder")"
    
    # Initialize markdown file with CSS and title for this folder
    index_md_file="$folder/index.md"
    cat > "$index_md_file" <<EOF
---
title: "$title"
---

<style>
body { 
    max-width: none !important; 
    margin: 20px !important; 
    font-family: Arial, sans-serif !important;
}
table { 
    width: 100% !important; 
    border-collapse: collapse !important; 
    table-layout: auto !important;
    border: 1px solid #ccc !important;
}
th, td {
    padding: 8px !important;
    vertical-align: top !important;
    border: 1px solid #ccc !important;
    white-space: nowrap !important;
}
th {
    background-color: #f0f0f0 !important;
    font-weight: bold !important;
}
th:nth-child(1), td:nth-child(1) {
    width: 1% !important;
    text-align: center !important;
}
th:nth-child(3), td:nth-child(3) { 
    white-space: normal !important;
    width: 100% !important;
}
th:nth-child(4), td:nth-child(4) {
    text-align: center !important;
}
th:nth-child(5), td:nth-child(5) {
    text-align: center !important;
}
th:nth-child(6), td:nth-child(6) {
    text-align: center !important;
}
</style>

| # | TRACKING NO | TITLE | REV | STATUS | SHA256 |
|---|---|---|---|---|---|
EOF
    
    # Find all files in current folder
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        
        # Skip index.md and index.html files
        if [[ "$filename" == "index.md" || "$filename" == "index.html" ]]; then
            continue
        fi
        
        # Parse ZDDC filename: trackingNumber_revision (status) - title.extension
        # Skip files that don't match ZDDC format
        if [[ ! "$filename" =~ ^([^_]+)_([^\ ]+)\ +\(([^\)]+)\)\ *-\ *(.+)\.([^.]+)$ ]]; then
            echo "  Skipping non-ZDDC file: $filename"
            continue
        fi
        
        tracking_number="${BASH_REMATCH[1]}"
        revision="${BASH_REMATCH[2]}"
        status="${BASH_REMATCH[3]}"
        doc_title="${BASH_REMATCH[4]}"
        extension="${BASH_REMATCH[5]}"
        
        # Remove tilde prefix from revision for comparison (draft indicator)
        clean_revision="${revision#~}"
        
        # Calculate SHA256
        sha256=$(sha256sum "$file" | cut -d' ' -f1)
        
        # Create full filename symlink (always safe to overwrite)
        ln -sf "$(realpath --relative-to="$OUTPUT_DIR" "$file")" "$OUTPUT_DIR/$filename"
        
        # Handle specific revision symlink with conflict detection
        specific_name="${tracking_number}_${revision}.${extension}"
        specific_path="$OUTPUT_DIR/$specific_name"
        
        if [ -L "$specific_path" ]; then
            # Symlink exists, check if it's the same file
            existing_target=$(readlink "$specific_path")
            existing_absolute=$(realpath "$OUTPUT_DIR/$existing_target" 2>/dev/null || echo "")
            current_absolute=$(realpath "$file")
            
            if [ "$existing_absolute" != "$current_absolute" ]; then
                # Different files claiming same revision - check SHA256
                if [ -f "$existing_absolute" ]; then
                    existing_sha256=$(sha256sum "$existing_absolute" | cut -d' ' -f1)
                    if [ "$existing_sha256" != "$sha256" ]; then
                        echo "  ERROR: Revision conflict for $specific_name"
                        echo "    Existing: $existing_absolute (SHA256: $existing_sha256)"
                        echo "    New:      $current_absolute (SHA256: $sha256)"
                        echo "    Different files claim to be the same revision. Skipping."
                        continue
                    else
                        echo "  Duplicate file detected for $specific_name (same SHA256), skipping symlink update"
                    fi
                else
                    echo "  Warning: Existing symlink target not found, updating: $specific_name"
                    ln -sf "$(realpath --relative-to="$OUTPUT_DIR" "$file")" "$specific_path"
                fi
            else
                echo "  Symlink already points to same file: $specific_name"
            fi
        else
            # No existing symlink, create it
            ln -sf "$(realpath --relative-to="$OUTPUT_DIR" "$file")" "$specific_path"
        fi
        
        # Track latest revision for each tracking number
        current_latest="${latest_files[$tracking_number]}"
        if [ -z "$current_latest" ]; then
            latest_files["$tracking_number"]="$file|$clean_revision"
        else
            current_rev="${current_latest#*|}"
            if [ "$(printf '%s\n%s\n' "$current_rev" "$clean_revision" | sort -V | tail -n1)" = "$clean_revision" ] && [ "$clean_revision" != "$current_rev" ]; then
                latest_files["$tracking_number"]="$file|$clean_revision"
            fi
        fi
        
        # Increment row counter
        row_counter=$((row_counter + 1))
        
        # Create hyperlinks relative to output directory from this folder
        rel_path_to_output=$(realpath --relative-to="$folder" "$OUTPUT_DIR")
        tracking_link="[$tracking_number]($rel_path_to_output/$tracking_number.$extension)"
        revision_link="[$revision]($rel_path_to_output/${tracking_number}_${revision}.$extension)"
        
        # Create truncated SHA256 for display
        sha256_short="${sha256:0:6}...${sha256: -6}"
        
        # Add to markdown table
        echo "| $row_counter | $tracking_link | $doc_title | $revision_link | $status | <span class=\"sha256\" title=\"$sha256\">$sha256_short</span> |" >> "$index_md_file"
        
        echo "  $filename -> symlinks created"
    done < <(find "$folder" -maxdepth 1 \( -type f -o -type l \) -print0)
    
    # Create/update latest revision symlinks for this folder
    echo "  Creating/updating latest revision symlinks..."
    for tracking_number in "${!latest_files[@]}"; do
        file_info="${latest_files[$tracking_number]}"
        file="${file_info%|*}"
        new_revision="${file_info#*|}"
        filename=$(basename "$file")
        
        # Extract extension
        extension="${filename##*.}"
        
        # Check latest symlink
        latest_name="${tracking_number}.${extension}"
        latest_path="$OUTPUT_DIR/$latest_name"
        
        should_update=true
        
        if [ -L "$latest_path" ]; then
            # Existing latest symlink - check revision
            existing_target=$(readlink "$latest_path")
            existing_absolute=$(realpath "$OUTPUT_DIR/$existing_target" 2>/dev/null || echo "")
            
            if [ -f "$existing_absolute" ]; then
                existing_revision=$(get_revision_from_target "$existing_absolute")
                
                if [ -n "$existing_revision" ]; then
                    if is_revision_greater "$new_revision" "$existing_revision"; then
                        echo "    Updating latest: $latest_name ($existing_revision -> $new_revision)"
                    else
                        echo "    Keeping existing latest: $latest_name (current: $existing_revision >= new: $new_revision)"
                        should_update=false
                    fi
                else
                    echo "    Warning: Could not parse revision from existing target, updating: $latest_name"
                fi
            else
                echo "    Warning: Existing latest symlink target not found, updating: $latest_name"
            fi
        else
            echo "    Creating new latest: $latest_name -> $filename"
        fi
        
        if [ "$should_update" = true ]; then
            ln -sf "$(realpath --relative-to="$OUTPUT_DIR" "$file")" "$latest_path"
        fi
    done

    # Convert markdown to HTML with pandoc for this folder
    echo "  Converting to HTML..."
    if command -v pandoc >/dev/null 2>&1; then
        pandoc "$index_md_file" -o "$folder/index.html" \
            --standalone \
            --embed-resources \
            --from markdown+raw_html
        
        echo "    Markdown file: $folder/index.md"
        echo "    HTML file: $folder/index.html"
    else
        echo "    Warning: pandoc not found, skipping HTML conversion"
        echo "    Markdown file: $folder/index.md"
    fi
    
    # Reset associative array for next folder
    unset latest_files
done

# Count symlinks
symlink_count=$(find "$OUTPUT_DIR" -type l | wc -l)

echo ""
echo "Summary:"
echo "  Output directory: $OUTPUT_DIR"
echo "  Symlinks created: $symlink_count"
for folder in "$@"; do
    echo "  Markdown file: $folder/index.md"
    echo "  HTML file: $folder/index.html"
done
