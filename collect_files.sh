#!/usr/bin/env bash
# collect_files.sh
# Usage:
#   ./collect_files.sh <target_directory>                                    → tổng hợp files thành .md
#   ./collect_files.sh extract <collected.md> [output_dir]                  → giải nén files từ .md
#   ./collect_files.sh collect-subfolders <target_directory> [output_dir]   → collect từng subfolder riêng

# ./collect_files.sh extract ./collects_files/extension-Smart-auto-agents.md ./projects/extension-Smart-auto-agents
# ./collect_files.sh collect-subfolders ./apps ./collects_apps_files  --> tạo file riêng cho mỗi subfolder


# -------------------------------------
# Cơ chế hoạt động:
# Đọc file .md theo format do collect tạo ra
# Phát hiện header ## \path/to/file\`` để lấy đường dẫn từng file
# Phát hiện khối ``lang ... ``` để lấy nội dung - Tự động tạo cây thư mục con theo đúng cấu trúc gốc (mkdir -p) - **Xử lý dòng trống thừa**: script collect luôn thêm echo "" sau cat, hàm extract dùng cơ chế buffer 1 dòng để loại bỏ dòng trắng thừa cuối mỗi file khi giải nén - Cảnh báo nếu file .md bị cắt giữa chừng (fence chưa đóng)
# -------------------------------------

set -euo pipefail

# ──────────────────────────────────────────────
# Helper: detect language for fenced code block
# ──────────────────────────────────────────────
get_lang() {
    local file="$1"
    local ext="${file##*.}"
    [[ "$ext" == "$file" ]] && ext=""   # no extension

    case "$ext" in
        sh|bash)        echo "sh" ;;
        py)             echo "py" ;;
        js)             echo "js" ;;
        ts)             echo "ts" ;;
        jsx)            echo "jsx" ;;
        tsx)            echo "tsx" ;;
        html|htm)       echo "html" ;;
        css)            echo "css" ;;
        scss)           echo "scss" ;;
        sass)           echo "sass" ;;
        json)           echo "json" ;;
        yaml|yml)       echo "yaml" ;;
        toml)           echo "toml" ;;
        xml)            echo "xml" ;;
        md|markdown)    echo "md" ;;
        sql)            echo "sql" ;;
        go)             echo "go" ;;
        rs)             echo "rs" ;;
        java)           echo "java" ;;
        c)              echo "c" ;;
        cpp|cc|cxx)     echo "cpp" ;;
        h|hpp)          echo "h" ;;
        cs)             echo "cs" ;;
        php)            echo "php" ;;
        rb)             echo "rb" ;;
        swift)          echo "swift" ;;
        kt)             echo "kt" ;;
        r)              echo "r" ;;
        lua)            echo "lua" ;;
        vim)            echo "vim" ;;
        dockerfile|Dockerfile) echo "dockerfile" ;;
        env)            echo "sh" ;;
        txt)            echo "txt" ;;
        *)              echo "$ext" ;;
    esac
}

# ──────────────────────────────────────────────
# Helper: check if a file is binary
# ──────────────────────────────────────────────
is_binary() {
    if command -v file &>/dev/null; then
        file --mime-encoding "$1" 2>/dev/null | grep -q "binary"
    else
        LC_ALL=C grep -qP '\x00' "$1" 2>/dev/null
    fi
}

# ──────────────────────────────────────────────
# Helper: check if a file should always be skipped (lock files, generated, minified, etc.)
# ──────────────────────────────────────────────
is_skip_file() {
    local file="$1"
    local base
    base="$(basename "$file")"

    # Lock files / auto-generated dependency manifests
    case "$base" in
        package-lock.json|yarn.lock|pnpm-lock.yaml|bun.lockb|\
        composer.lock|poetry.lock|Pipfile.lock|\
        go.sum|Cargo.lock|\
        gradle.lockfile|*.resolved)
            return 0
            ;;
    esac

    # Minified / source-map files by suffix
    case "$base" in
        *.min.js|*.min.css|*.min.mjs|\
        *.js.map|*.css.map|*.ts.map|*.mjs.map)
            return 0
            ;;
    esac

    return 1
}

# ──────────────────────────────────────────────
# Helper: allow only source/config/text project files
# ──────────────────────────────────────────────
is_collectible_source() {
    local file="$1"
    local base
    local ext

    base="$(basename "$file")"
    ext="${base##*.}"
    [[ "$ext" == "$base" ]] && ext=""

    # Always skip lock/generated/minified files
    if is_skip_file "$file"; then
        return 1
    fi

    case "$base" in
        Dockerfile|Containerfile|Makefile|Jenkinsfile|Procfile|Vagrantfile|Gemfile|Rakefile|requirements.txt|requirements-*.txt|package.json|composer.json|go.mod|Cargo.toml|pyproject.toml|Pipfile|pytest.ini|tox.ini|setup.py|setup.cfg|MANIFEST.in|CMakeLists.txt|meson.build|build.gradle|build.gradle.kts|settings.gradle|settings.gradle.kts|pom.xml|gradlew|gradlew.bat|mvnw|mvnw.cmd|tsconfig.json|jsconfig.json|turbo.json|nx.json|deno.json|deno.jsonc|nodemon.json|webpack.config.js|webpack.config.cjs|webpack.config.mjs|webpack.config.ts|vite.config.js|vite.config.ts|rollup.config.js|rollup.config.ts|eslint.config.js|eslint.config.cjs|eslint.config.mjs|eslint.config.ts|.env|.env.*|.gitignore|.gitattributes|.dockerignore|.editorconfig|.prettierrc|.prettierignore|.eslintrc|.eslintrc.*|.npmrc|.yarnrc|.yarnrc.yml|README|README.*|LICENSE|LICENSE.*|CHANGELOG|CHANGELOG.*)
            return 0
            ;;
    esac

    case "$ext" in
        sh|bash|zsh|fish|ps1|bat|cmd|py|pyi|pyx|js|cjs|mjs|jsx|ts|tsx|vue|svelte|java|kt|kts|groovy|gradle|go|rs|rb|php|swift|scala|clj|cljs|c|cc|cpp|cxx|h|hh|hpp|cs|fs|fsx|vb|sql|graphql|gql|proto|thrift|lua|pl|pm|r|R|jl|nim|zig|dart|elm|ex|exs|erl|hrl|hs|lhs|ml|mli|m|mm|asm|s|toml|yaml|yml|json|jsonc|json5|xml|xsd|xsl|wsdl|ini|cfg|conf|config|env|properties|plist|editorconfig|md|markdown|txt|rst|adoc|tex|csv|tsv|gitignore|gitattributes|dockerignore)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# ──────────────────────────────────────────────
# Subcommand: extract
# Giải nén toàn bộ files từ file .md đã tổng hợp
# Usage: ./collect_files.sh extract <collected.md> [output_dir]
# ──────────────────────────────────────────────
cmd_extract() {
    local input_file="${1:-}"
    local output_dir="${2:-}"

    if [[ -z "$input_file" ]]; then
        echo "Usage: $0 extract <collected.md> [output_dir]"
        echo "  collected.md  : file .md được tạo bởi lệnh collect"
        echo "  output_dir    : thư mục đích (mặc định: tên file bỏ đuôi + '_extracted')"
        exit 1
    fi

    # Normalize path separators
    input_file=$(echo "$input_file" | sed 's/\\/\//g')

    if [[ ! -f "$input_file" ]]; then
        echo "Lỗi: '$input_file' không tồn tại hoặc không phải file." >&2
        exit 1
    fi

    # Default output dir: strip extension, append _extracted
    if [[ -z "$output_dir" ]]; then
        local base="${input_file##*/}"
        base="${base%.*}"
        output_dir="${base}_extracted"
    fi

    output_dir=$(echo "$output_dir" | sed 's/\\/\//g')
    mkdir -p "$output_dir"

    local current_file=""
    local in_fence=false
    local total=0
    local skipped=0
    # Buffer dòng cuối để bỏ dòng trống thừa do echo "" trong collect
    local pending_line=""
    local has_pending=false

    while IFS= read -r line; do
        # Loại bỏ ký tự \r (CR) ở cuối dòng nếu có – xử lý file CRLF trên Windows
        line="${line%$'\r'}"

        # Phát hiện header: ## `path/to/file`
        if [[ "$line" =~ ^##[[:space:]]\`(.+)\`$ ]]; then
            current_file="${BASH_REMATCH[1]}"
            in_fence=false
            has_pending=false
            pending_line=""
            continue
        fi

        # Phát hiện dòng mở fence: ```lang (khi đang có current_file)
        if [[ -n "$current_file" ]] && [[ "$in_fence" == false ]] && [[ "$line" =~ ^\`\`\` ]]; then
            in_fence=true
            has_pending=false
            pending_line=""
            # Tạo thư mục cha và khởi tạo file trắng
            local dest="$output_dir/$current_file"
            mkdir -p "$(dirname "$dest")"
            > "$dest"
            continue
        fi

        # Đang trong fence
        if [[ "$in_fence" == true ]]; then
            # Phát hiện dòng đóng fence: ``` (chính xác 3 backtick, không có gì khác)
            if [[ "$line" == '```' ]]; then
                # Ghi pending_line nếu nó không phải dòng trống thừa cuối block
                # (collect_files thêm echo "" sau cat → luôn có 1 dòng trắng trước ```)
                # → bỏ qua pending_line nếu nó là chuỗi rỗng
                if [[ "$has_pending" == true ]] && [[ -n "$pending_line" ]]; then
                    printf '%s\n' "$pending_line" >> "$output_dir/$current_file"
                fi
                in_fence=false
                has_pending=false
                pending_line=""
                (( total++ )) || true
                current_file=""
                continue
            fi

            # Ghi dòng đang buffer (pending), sau đó buffer dòng mới
            if [[ "$has_pending" == true ]]; then
                printf '%s\n' "$pending_line" >> "$output_dir/$current_file"
            fi
            pending_line="$line"
            has_pending=true
        fi

    done < "$input_file"

    # Xử lý file bị cắt giữa chừng (fence không đóng)
    if [[ "$in_fence" == true ]] && [[ -n "$current_file" ]]; then
        if [[ "$has_pending" == true ]]; then
            printf '%s\n' "$pending_line" >> "$output_dir/$current_file"
        fi
        echo "Cảnh báo: file '$current_file' có thể bị cắt giữa chừng." >&2
        (( total++ )) || true
    fi

    echo "Hoàn tất giải nén!"
    echo "  - File đầu vào  : $input_file"
    echo "  - Thư mục đích  : $output_dir"
    echo "  - Đã giải nén   : ${total} file(s)"
    [[ $skipped -gt 0 ]] && echo "  - Bỏ qua        : ${skipped} file(s)"
}

# ──────────────────────────────────────────────
# Subcommand: collect-subfolders
# Tạo file .md riêng cho mỗi subfolder trực tiếp của folder cha.
# Files nằm trực tiếp trong folder cha được gom vào file <name>_root_collected_files.md
# Usage: ./collect_files.sh collect-subfolders <target_directory> [output_dir]
# ──────────────────────────────────────────────
cmd_collect_subfolders() {
    local target_dir="${1:-}"
    local output_dir="${2:-.}"

    if [[ -z "$target_dir" ]]; then
        echo "Usage: $0 collect-subfolders <target_directory> [output_dir]"
        echo "  target_directory : thư mục cha cần quét"
        echo "  output_dir       : thư mục chứa các file .md đầu ra (mặc định: thư mục hiện tại)"
        exit 1
    fi

    target_dir=$(echo "$target_dir" | sed 's/\\/\//g')

    if [[ ! -d "$target_dir" ]]; then
        echo "Lỗi: '$target_dir' không phải là thư mục hợp lệ." >&2
        exit 1
    fi

    target_dir="$(cd "$target_dir" && pwd)"
    mkdir -p "$output_dir"

    local parent_name="${target_dir##*/}"
    local total_files=0
    local total_dirs=0

    echo "Bắt đầu collect subfolders của: $target_dir"
    echo ""

    # ── Helper: build output cho một thư mục ──────────────────────────
    _collect_one_dir() {
        local src_dir="$1"      # thư mục cần quét
        local out_file="$2"     # file .md đầu ra
        local label="$3"        # nhãn hiển thị trong header
        local max_depth="${4:-}"  # nếu set thì dùng -maxdepth
        local file_count=0
        local skipped_count=0
        local skipped_non_source_count=0

        {
            echo "# Collected Files - ${label}"
            echo ""
            echo "> **Nguồn:** \`${src_dir}\`"
            # echo "> **Ngày tạo:** $(date '+%Y-%m-%d %H:%M:%S')"
            echo "> **Bộ lọc:** chỉ collect source/config/script text; bỏ qua dependency, env, build cache, media và binary"
            echo ""
            echo "---"
            echo ""

            while IFS= read -r abs_path; do
                local rel_path="${abs_path#$src_dir/}"

                if ! is_collectible_source "$abs_path"; then
                    echo "<!-- SKIPPED (non-source): $rel_path -->"
                    (( skipped_non_source_count++ )) || true
                    continue
                fi

                if is_binary "$abs_path"; then
                    echo "<!-- SKIPPED (binary): $rel_path -->"
                    (( skipped_count++ )) || true
                    continue
                fi

                local lang
                lang=$(get_lang "$abs_path")
                (( file_count++ )) || true

                echo "## \`$rel_path\`"
                echo ""
                echo "\`\`\`${lang}"
                cat "$abs_path"
                echo ""
                echo "\`\`\`"
                echo ""
                echo "---"
                echo ""

            done < <(
                if [[ -n "$max_depth" ]]; then
                    find "$src_dir" -maxdepth "$max_depth" -type f | sort
                else
                    find "$src_dir" \
                        \( -type d \( \
                            -name .git -o -name .hg -o -name .svn -o -name .idea -o \
                            -name .vscode -o -name .claude -o -name __pycache__ -o \
                            -name .pytest_cache -o -name .mypy_cache -o -name .ruff_cache -o \
                            -name .tox -o -name .nox -o -name .venv -o -name venv -o \
                            -name env -o -name ENV -o -name node_modules -o \
                            -name bower_components -o -name vendor -o -name dist -o \
                            -name build -o -name target -o -name out -o -name coverage -o \
                            -name htmlcov -o -name public -o -name .next -o -name .nuxt -o \
                            -name .svelte-kit -o -name .parcel-cache -o -name tmp -o \
                            -name temp -o -name logs \
                        \) -prune \) -o \
                        -type f -print \
                    | sort
                fi
            )

            echo ""
            echo "<!-- Tổng: ${file_count} file(s) được tổng hợp, ${skipped_count} file(s) bị bỏ qua (binary), ${skipped_non_source_count} file(s) bị bỏ qua (non-source) -->"

        } > "$out_file"

        # Trả về số file đã collect qua stdout của caller
        echo "$file_count"
    }

    # 1. Collect files trực tiếp trong folder cha (maxdepth 1, chỉ files)
    local root_output="$output_dir/${parent_name}_root_collected_files.md"
    local root_count
    root_count=$(_collect_one_dir "$target_dir" "$root_output" "${parent_name} (root)" "1")
    echo "  [root] $root_output (${root_count} file(s))"
    (( total_files += root_count )) || true

    # 2. Collect từng subfolder trực tiếp
    local _skip_dirs=".git .hg .svn .idea .vscode .claude __pycache__ .pytest_cache"
    _skip_dirs+=" .mypy_cache .ruff_cache .tox .nox .venv venv env ENV"
    _skip_dirs+=" node_modules bower_components vendor dist build target out"
    _skip_dirs+=" coverage htmlcov public .next .nuxt .svelte-kit .parcel-cache tmp temp logs"

    while IFS= read -r subdir; do
        local subdir_name="${subdir##*/}"

        # Bỏ qua thư mục hệ thống / dependency
        local _skip=false
        for _sd in $_skip_dirs; do
            if [[ "$subdir_name" == "$_sd" ]]; then
                _skip=true
                break
            fi
        done
        [[ "$_skip" == true ]] && continue

        local sub_output="$output_dir/${parent_name}_${subdir_name}_collected_files.md"
        local sub_count
        sub_count=$(_collect_one_dir "$subdir" "$sub_output" "${subdir_name}" "")
        echo "  [${subdir_name}] $sub_output (${sub_count} file(s))"
        (( total_files += sub_count )) || true
        (( total_dirs++ )) || true

    done < <(find "$target_dir" -maxdepth 1 -mindepth 1 -type d | sort)

    echo ""
    echo "Hoàn tất!"
    echo "  - Thư mục cha    : $target_dir"
    echo "  - Thư mục đầu ra : $output_dir"
    echo "  - Subfolders     : ${total_dirs} folder(s)"
    echo "  - Tổng files     : ${total_files} file(s)"
}

# ──────────────────────────────────────────────
# Dispatch subcommand
# ──────────────────────────────────────────────
if [[ "${1:-}" == "extract" ]]; then
    shift
    cmd_extract "$@"
    exit 0
fi

if [[ "${1:-}" == "collect-subfolders" ]]; then
    shift
    cmd_collect_subfolders "$@"
    exit 0
fi

# ──────────────────────────────────────────────
# Subcommand: collect (default)
# ──────────────────────────────────────────────
TARGET_DIR="${1:-}"
OUTPUT_FILE="${2:-collected_files.md}"

# set OUTPUT_FILE as folder name + _collected_files.md
OUTPUT_FILE="${TARGET_DIR##*/}_collected_files.md"
if [[ -z "$TARGET_DIR" ]]; then
    echo "Usage:"
    echo "  $0 <target_directory>                                    → tổng hợp files thành .md"
    echo "  $0 extract <collected.md> [output_dir]                   → giải nén files từ .md"
    echo "  $0 collect-subfolders <target_directory> [output_dir]    → collect từng subfolder riêng"
    echo ""
    echo "  target_directory  : thư mục cần quét"
    echo "  output_file       : file đầu ra (mặc định: <tên_thư_mục>_collected_files.md)"
    exit 1
fi

# replace '\' to '/'
TARGET_DIR=$(echo "$TARGET_DIR" | sed 's/\\/\//g')

if [[ ! -d "$TARGET_DIR" ]]; then
    echo "Lỗi: '$TARGET_DIR' không phải là thư mục hợp lệ." >&2
    exit 1
fi

# Resolve absolute path of the target directory
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# ──────────────────────────────────────────────
# Build output
# ──────────────────────────────────────────────
{
    echo "# Collected Files"
    echo ""
    echo "> **Nguồn:** \`${TARGET_DIR}\`"
    echo "> **Ngày tạo:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo "> **Bộ lọc:** chỉ collect source/config/script text; bỏ qua dependency, env, build cache, media và binary"
    echo ""
    echo "---"
    echo ""

    file_count=0
    skipped_count=0
    skipped_non_source_count=0

    # Find all regular files, sorted by path, while pruning dependency/env/build dirs
    while IFS= read -r abs_path; do
        # Compute relative path from TARGET_DIR
        rel_path="${abs_path#$TARGET_DIR/}"

        if ! is_collectible_source "$abs_path"; then
            echo "<!-- SKIPPED (non-source): $rel_path -->"
            (( skipped_non_source_count++ )) || true
            continue
        fi

        # Skip binary files
        if is_binary "$abs_path"; then
            echo "<!-- SKIPPED (binary): $rel_path -->"
            (( skipped_count++ )) || true
            continue
        fi

        lang=$(get_lang "$abs_path")
        (( file_count++ )) || true

        echo "## \`$rel_path\`"
        echo ""
        echo "\`\`\`${lang}"
        cat "$abs_path"
        # Ensure newline at end of block
        echo ""
        echo "\`\`\`"
        echo ""
        echo "---"
        echo ""

    done < <(
        find "$TARGET_DIR" \
            \( -type d \( \
                -name .git -o \
                -name .hg -o \
                -name .svn -o \
                -name .idea -o \
                -name .vscode -o \
                -name .claude -o \
                -name __pycache__ -o \
                -name .pytest_cache -o \
                -name .mypy_cache -o \
                -name .ruff_cache -o \
                -name .tox -o \
                -name .nox -o \
                -name .venv -o \
                -name venv -o \
                -name env -o \
                -name ENV -o \
                -name node_modules -o \
                -name bower_components -o \
                -name vendor -o \
                -name dist -o \
                -name build -o \
                -name target -o \
                -name out -o \
                -name coverage -o \
                -name htmlcov -o \
                -name public -o \
                -name .next -o \
                -name .nuxt -o \
                -name .svelte-kit -o \
                -name .parcel-cache -o \
                -name tmp -o \
                -name temp -o \
                -name logs \
            \) -prune \) -o \
            -type f -print \
        | sort
    )

    echo ""
    echo "<!-- Tổng: ${file_count} file(s) được tổng hợp, ${skipped_count} file(s) bị bỏ qua (binary), ${skipped_non_source_count} file(s) bị bỏ qua (non-source) -->"

} > "$OUTPUT_FILE"

echo "Hoàn tất!"
echo "  - File đầu ra : $OUTPUT_FILE"
echo "  - Thư mục quét: $TARGET_DIR"
echo "  - Đã tổng hợp : ${file_count} file(s)"
[[ $skipped_count -gt 0 ]] && echo "  - Bỏ qua       : ${skipped_count} file(s) nhị phân (binary)"
[[ $skipped_non_source_count -gt 0 ]] && echo "  - Bỏ qua       : ${skipped_non_source_count} file(s) không phải source/config"
