import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';
import { headers } from '../utils/headers';
import { baseURL } from '../utils/baseURL';
interface ConvertResponse {
    message: string;
    status: 'success' | 'processing';
}

const PdfToPptConverter: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setMessage('');
        }
    };

    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setMessage('変換中...（これには数秒かかる場合があります）');

    try {
        const base64Data = await toBase64(file);
        const postData = {
            pdfBase64: base64Data,
            fileName: file.name
        };

        // 1. axiosで responseType: 'blob' を指定してリクエスト
        const response = await axios.post(`${baseURL}/api/pdftoppt`, postData, {
            headers,
            responseType: 'blob', // バイナリデータとして受け取る
        });

        // 2. 「名前を付けて保存」ダイアログを表示
        // ブラウザが showSaveFilePicker に対応している場合（Chrome, Edgeなど）
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: file.name.replace('.pdf', '.pptx'),
                    types: [{
                        description: 'PowerPoint Presentation',
                        accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] },
                    }],
                });

                const writable = await handle.createWritable();
                await writable.write(response.data);
                await writable.close();
                setMessage('指定された場所に保存が完了しました。');
            } catch (err) {
                // ユーザーがキャンセルした場合はここに来る
                setMessage('保存がキャンセルされました。');
            }
        } else {
            // 対応していないブラウザ（Safari, Firefoxなど）用のフォールバック
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', file.name.replace('.pdf', '.pptx'));
            document.body.appendChild(link);
            link.click();
            link.remove();
            setMessage('ダウンロードフォルダに保存しました。');
        }

    } catch (error) {
        console.error(error);
        setMessage('エラーが発生しました。バックエンドの制限（Payloadサイズ等）を確認してください。');
    } finally {
        setLoading(false);
    }
};

    const containerStyle: React.CSSProperties = { padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' };
    const cardStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: '12px', padding: '30px', maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff' };
    const buttonStyle: React.CSSProperties = {
        padding: '12px 24px',
        backgroundColor: file && !loading ? '#2563eb' : '#93c5fd',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: file && !loading ? 'pointer' : 'not-allowed',
        fontSize: '16px',
        fontWeight: 'bold',
        marginTop: '20px'
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h2 style={{ color: '#1f2937', marginBottom: '20px' }}>PDF to PPT 変換ツール</h2>

                <div style={{ marginBottom: '20px' }}>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        style={{ display: 'block', width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>

                <button
                    onClick={handleConvert}
                    disabled={!file || loading}
                    style={buttonStyle}
                >
                    {loading ? '処理中...' : '変換を開始する'}
                </button>

                {message && (
                    <div style={{
                        marginTop: '20px',
                        padding: '10px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#374151',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {message}
                    </div>
                )}
            </div>
            <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '12px' }}>
                ※変換されたファイルはサーバー上の exports フォルダに保存されます。
            </p>
        </div>
    );
};

export default PdfToPptConverter;