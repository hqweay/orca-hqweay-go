MINOR_COMMITS=""
PATCH_COMMITS=""
COMMITS=$(git log -n 10 --oneline --no-merges)
while IFS= read -r line; do
    MSG=$(echo "$line" | cut -d' ' -f2-)
    
    if echo "$MSG" | grep -qE "^release: v[0-9]+"; then
        continue
    fi
        
    if echo "$MSG" | grep -qE "^feat(\(.+\))?!?: "; then
        DESC=$(echo "$MSG" | sed -E 's/^[a-z]+(\([^)]+\))?!?: //')
        MINOR_COMMITS="${MINOR_COMMITS}- ${DESC}\n"
    elif echo "$MSG" | grep -qE "^[a-z]+(\(.+\))?!?: "; then
        DESC=$(echo "$MSG" | sed -E 's/^[a-z]+(\([^)]+\))?!?: //')
        PATCH_COMMITS="${PATCH_COMMITS}- ${DESC}\n"
    else
        PATCH_COMMITS="${PATCH_COMMITS}- ${MSG}\n"
    fi
done <<< "$COMMITS"

echo "MINOR:"
echo -e "$MINOR_COMMITS"
echo "PATCH:"
echo -e "$PATCH_COMMITS"
