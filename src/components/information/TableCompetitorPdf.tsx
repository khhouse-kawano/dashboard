import React, {memo} from 'react';

type Props = {
    userName: string,
    competitorPdfFile: { name: string, file: File | null, path?: string, staff?: string }[],
    setCompetitorPdfFile: React.Dispatch<React.SetStateAction<{ name: string, file: File | null, path?: string, staff?: string }[]>>
}

const TableCompetitorPdf = ({userName, setCompetitorPdfFile, competitorPdfFile}: Props) => {
    return (
        <div className="d-flex flex-column gap-2 py-1">
            <input
                type="file"
                accept="application/pdf"
                multiple
                className="form-control form-control-sm border shadow-sm"
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                        const newFiles = files.map(file => ({
                            name: file.name,
                            file: file,
                            staff: userName
                        }));
                        console.log(newFiles)
                        setCompetitorPdfFile(prev => [...prev, ...newFiles]);
                    }
                    e.target.value = '';
                }}
            />

            {competitorPdfFile.length > 0 && (
                <div className="d-flex flex-column gap-2 mt-1">
                    {competitorPdfFile.map((item, index) => (
                        <div key={index} className="d-flex align-items-center gap-2">
                            <a
                                href={`https://khg-marketing.info/dashboard/api/gateway/handlers${String(item.path)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary text-decoration-none"
                                style={{ fontSize: '12px', transition: 'opacity 0.2s', cursor: 'pointer' }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                <i className="fa-solid fa-file-pdf text-danger" style={{ fontSize: '1.2rem' }}></i>
                            </a>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                value={item.name}
                                placeholder="保存するファイル名"
                                onChange={(e) => {
                                    const updatedFiles = [...competitorPdfFile];
                                    updatedFiles[index].name = e.target.value;
                                    setCompetitorPdfFile(updatedFiles);
                                }}
                            />
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2"
                                onClick={() => {
                                    setCompetitorPdfFile(prev => prev.filter((_, i) => i !== index));
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

    )
}

export default memo(TableCompetitorPdf, (prevProps, nextProps) => {
    if (prevProps.userName !== nextProps.userName) return false;
    if (prevProps.competitorPdfFile !== nextProps.competitorPdfFile) return false;

    return true; 
});