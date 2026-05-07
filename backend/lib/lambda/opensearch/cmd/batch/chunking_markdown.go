package main

import (
	"bytes"
	"regexp"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

// 各見出しセクションをコードブロックとテキストブロックに分割してChunkのリストで返却
// コードブロックごとにchunk分割 + 残ったコードブロック以外のテキストのチャンクも1つ作成
func splitSectionToChunks(section string) []string {
	lines := strings.Split(section, "\n")

	var textLines []string
	var codeLines []string
	var codeChunks []string
	inCode := false

	for _, line := range lines {
		if strings.HasPrefix(line, "```") {
			if !inCode {
				inCode = true
				codeLines = append(codeLines, line)
			} else {
				inCode = false
				codeLines = append(codeLines, line)
				codeChunks = append(codeChunks, strings.Join(codeLines, "\n"))
				codeLines = nil
			}
		} else if inCode {
			codeLines = append(codeLines, line)
		} else {
			textLines = append(textLines, line)
		}
	}
	textChunk := strings.TrimSpace(strings.Join(textLines, "\n"))

	var chunks []string

	if textChunk != "" {
		chunks = append(chunks, textChunk)
	}

	chunks = append(chunks, codeChunks...)

	return chunks
}

// セクションごとに再精査
func processChunks(sections []string) []string {
	var chunks []string
	for _, section := range sections {
		sectionChunks := splitSectionToChunks(section)
		chunks = append(chunks, sectionChunks...)
	}
	return chunks
}

// 正規表現による前処理
func preProcessMarkdown(source []byte) []byte {
	// 1. frontmatter を削除
	if bytes.HasPrefix(source, []byte("---\n")) {
		rest := source[4:]
		if end := bytes.Index(rest, []byte("\n---\n")); end != -1 {
			source = rest[end+5:]
		}
	}

	// 2. Zenn埋め込み記法を削除: @[tag](url)
	zennEmbedRe := regexp.MustCompile(`(?m)^@\[[^\]]+\]\([^)]*\)\n?`)
	source = zennEmbedRe.ReplaceAll(source, []byte(""))

	// 3. Zennブロック記法のデリミタ行のみ削除・コンテンツは残す
	// :::message, :::message alert, :::details タイトル, ::: を削除
	zennBlockRe := regexp.MustCompile(`(?m)^:::.*$\n?`)
	source = zennBlockRe.ReplaceAll(source, []byte(""))

	// 4. 画像を削除: ![alt](url)
	imageRe := regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`)
	source = imageRe.ReplaceAll(source, []byte(""))

	// 5. リンクはテキスト部分のみ残す: [text](url) → text
	linkRe := regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
	source = linkRe.ReplaceAll(source, []byte("$1"))

	// 6. 脚注参照を削除: [^1]
	footnoteRefRe := regexp.MustCompile(`\[\^[^\]]+\]`)
	source = footnoteRefRe.ReplaceAll(source, []byte(""))

	// 7. インライン脚注はテキスト部分のみ残す: ^[内容] → 内容
	inlineFootnoteRe := regexp.MustCompile(`\^\[([^\]]+)\]`)
	source = inlineFootnoteRe.ReplaceAll(source, []byte("$1"))

	// 8. 水平線を削除: ---, ***, ___
	hrRe := regexp.MustCompile(`(?m)^[ \t]*(?:[-*_][ \t]*){3,}$\n?`)
	source = hrRe.ReplaceAll(source, []byte(""))

	// 9. 連続する2以上の空行を1行に正規化
	multiBlankRe := regexp.MustCompile(`\n{3,}`)
	source = multiBlankRe.ReplaceAll(source, []byte("\n\n"))

	return source
}

// 見出しのみのセクションを次のセクションに結合する
// 末尾に残った見出しのみのセクション（## 参考資料 等）は破棄
func mergeSingleHeadingSections(sections []string) []string {
	var result []string
	pendingHeading := ""

	for _, section := range sections {
		// 見出し行の次以降にコンテンツがあるか確認
		parts := strings.SplitN(section, "\n", 2)
		hasContent := len(parts) > 1 && strings.TrimSpace(parts[1]) != ""

		if !hasContent {
			// コンテンツなし → 次のセクションへ持ち越す
			pendingHeading += section
		} else {
			// コンテンツあり → pendingがあれば先頭に結合して追加
			result = append(result, pendingHeading+section)
			pendingHeading = ""
		}
	}
	// pendingHeadingが残った場合（## 参考資料 等）はRAGとして意味がないため破棄

	return result
}

// 3. 見出し#の行頭位置をListで取得
func collectHeadingOffsets(source []byte) []int {
	// Markdown parser
	doc := goldmark.New().Parser().Parse(text.NewReader(source))
	var offsets []int
	ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		// 終了位置は無視
		if !entering {
			return ast.WalkContinue, nil
		}
		// Headingを取得
		h, ok := n.(*ast.Heading)
		// 不正なHeadingは無視
		if !ok || h.Lines().Len() == 0 {
			return ast.WalkContinue, nil
		}
		// h.Lines().At(0).Start は 見出し記号(#) の後のテキストが始まる位置のため
		// 行頭位置(改行手前)を取得するよう調整
		offset := h.Lines().At(0).Start
		for offset > 0 && source[offset-1] != '\n' {
			offset--
		}
		offsets = append(offsets, offset)
		return ast.WalkContinue, nil
	})
	return offsets
}

// 4. collectHeadingOffsetsで取得した見出しの行頭位置をもとに
// セクションを分割してstringのListで返却
func splitIntoSections(source []byte, offsets []int) []string {
	sections := make([]string, len(offsets))
	for i, start := range offsets {
		// デフォルトはファイル末尾
		end := len(source)
		// 次の見出しがあればそこまで
		if i+1 < len(offsets) {
			end = offsets[i+1]
		}
		sections[i] = string(source[start:end])
	}
	return sections
}

// メイン処理
func chunkingMarkdown(input string) []string {
	source := []byte(input)
	source = preProcessMarkdown(source)
	offsets := collectHeadingOffsets(source)
	sections := splitIntoSections(source, offsets)
	sections = mergeSingleHeadingSections(sections)
	chunks := processChunks(sections)
	return chunks
}
