import { useState } from 'react';
import Form from './Form';
import Edit from './Edit';

export const Dashboard = () => {
    const [category, setCategory] = useState('edit');
    const [edit, setEditId] = useState('');

    const headerStyle = {
        width: '100%',
        margin: '0 auto',
        position: 'fixed' as const,
        backgroundColor: '#fff',
        zIndex: '1000',
    };

    const flexStyle = {
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        letterSpacing: '1px',
        fontWeight: '600',
    }

    const buttonStyle = (value: string) => {
        return ({
            opacity: value === category ? '1' : '.5',
            transform: value === category ? 'scale(1)' : 'scale(.8)',
            cursor: value !== category ? 'pointer' : '',
        })
    };

    return (
        <>
            <div style={headerStyle}>
                <div className="d-flex py-3 justify-content-around" style={flexStyle}>
                    <div className={"bg-success text-white py-1 px-4 rounded-pill"}
                        onClick={() => setCategory('edit')}
                        style={buttonStyle('edit')}
                    ><i className="fa-solid fa-pen-to-square me-1"></i>写真情報の編集</div>
                    <div className={"bg-primary text-white py-1 px-4 rounded-pill"}
                        style={buttonStyle('upload')}
                        onClick={() => setCategory('upload')}
                    ><i className="fa-solid fa-camera me-1"></i>写真の投稿</div>
                </div>
            </div>
            {category === 'upload' ? <Form editId={edit} setEditId={setEditId} /> : <Edit editId={edit} setEditId={setEditId} />}
        </>
    )
}
