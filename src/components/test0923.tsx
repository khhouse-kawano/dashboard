import React, { useState, useRef } from 'react';

const Test0923 = () => {
    const initialHtml =
        '<strong style="color:#c15d00;">来場予約特典</strong><br>ご予約のうえご来場で<strong>20,000円分のギフトカード</strong>をプレゼント（毎月先着10名様）';
    const [html, setHtml] = useState(initialHtml);
    const editorRef = useRef<HTMLDivElement>(null);

    const applyCommand = (cmd: string, value?: string) => {
        document.execCommand(cmd, false, value); // シンプルに動く
    };

    const setColor = (color: string) => {
        document.execCommand('foreColor', false, color);
    };
    return (
        <div>
            <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => applyCommand('bold')}>Bold</button>
                    <button type="button" onClick={() => applyCommand('italic')}>Italic</button>
                    <button type="button" onClick={() => applyCommand('insertLineBreak')}>改行</button>
                    <button type="button" onClick={() => setColor('#c15d00')}>文字色 #c15d00</button>
                    <button type="button" onClick={() => setColor('#000')}>文字色 黒</button>
                    <button
                        type="button"
                        onClick={() => {
                            document.execCommand('bold');
                            setColor('#c15d00');
                        }}
                    >
                        強調(茶)
                    </button>
                </div>

                {/* エディタ本体 */}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                        minHeight: 140,
                        padding: 12,
                        border: '1px solid #ddd',
                        borderRadius: 6,
                        lineHeight: 1.7,
                        fontSize: 15,
                        fontFamily: "Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif",
                        background: '#fff',
                    }}
                    dangerouslySetInnerHTML={{ __html: html }}
                    onInput={(e) => setHtml((e.target as HTMLDivElement).innerHTML)}
                />

                {/* プレビュー（実際の表示に近いスタイル適用） */}
                <div
                    style={{
                        padding: 12,
                        border: '1px dashed #ccc',
                        borderRadius: 6,
                        background: '#f9fafb',
                    }}
                >
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
            </div></div>
    )
}

export default Test0923

