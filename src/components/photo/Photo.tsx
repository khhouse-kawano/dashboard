import React, { useState } from 'react';
import Form from './Form';
import Edit from './Edit';

export const Photo = () => {
    const [category, setCategory] = useState<string>('edit');
    const [editId, setEditId] = useState('');

    const headerStyle = {
        position: 'sticky' as const,
        top: 0,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        webkitBackdropFilter: 'blur(12px)',
        zIndex: 100,
        borderBottom: '1px solid #f1f3f5',
    };

    const containerStyle = {
        width: '90%',
        maxWidth: '400px',
        margin: '0 auto',
    };

    const segmentBaseStyle = {
        backgroundColor: '#eaeef2',
        borderRadius: '30px',
        padding: '3px',
        display: 'flex',
    };

    const tabButtonStyle = (isActive: boolean) => ({
        flex: 1,
        textAlign: 'center' as const,
        padding: '9px 16px',
        borderRadius: '26px',
        fontSize: '13px',
        fontWeight: 'bold' as const,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        backgroundColor: isActive ? '#198754' : 'transparent',
        color: isActive ? '#fff' : '#6c757d',
        boxShadow: isActive ? '0 3px 10px rgba(25, 135, 84, 0.25)' : 'none',
    });

    return (
        <>
            <div style={headerStyle} className="py-2 mt-3">
                <div style={containerStyle}>
                    <div style={segmentBaseStyle}>
                        <div
                            style={tabButtonStyle(category === 'edit')}
                            onClick={() => setCategory('edit')}
                        >
                            <i className="fa-solid fa-pen-to-square me-1"></i>写真情報の編集
                        </div>
                        <div
                            style={tabButtonStyle(category === 'upload')}
                            onClick={() => setCategory('upload')}
                        >
                            <i className="fa-solid fa-camera me-1"></i>写真の投稿
                        </div>
                    </div>
                </div>
                <div className="pt-2">
                    {category === 'upload' ? (
                        <Form editId={editId} setEditId={setEditId} category={category} setCategory={setCategory}/>
                    ) : (
                        <Edit editId={editId} setEditId={setEditId} category={category} setCategory={setCategory} />
                    )}
                </div>
            </div>
        </>
    );
};

export default Photo;