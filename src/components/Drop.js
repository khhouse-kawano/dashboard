import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const Drop = () => {
  const [files, setFiles] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: useCallback(acceptedFiles => {
      setFiles(prevFiles => [
        ...prevFiles,
        ...acceptedFiles.map(file => Object.assign(file, {
          preview: URL.createObjectURL(file)
        }))
      ]);
    }, []),
  });

  const handlePreview = (file) => {
    setSelectedImage(file.preview);
  };

  const fileList = files.map(file => (
    <li key={file.path} onClick={() => handlePreview(file)} style={{ cursor: 'pointer' }}>
      <img src={file.preview} alt={file.name} style={{ width: '50px', height: 'auto', marginRight: '10px', verticalAlign: 'middle' }} />
      {file.path} - {file.size} bytes
    </li>
  ));

  const previewArea = selectedImage && (
    <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
      <h4>プレビュー</h4>
      <img src={selectedImage} alt="プレビュー" style={{ maxWidth: '100%', maxHeight: '300px' }} />
    </div>
  );

  return (
    <section className="container">
      <div {...getRootProps({ className: 'dropzone border-secondary ' })}>
        <input {...getInputProps()} />
        <div className='bg-light p-5 text-secondary opacity-50 text-center'>画像をドラッグ＆ドロップまたはクリックして選択</div>
      </div>
      <aside style={{ marginTop: '20px' }}>
        <h4>アップロードされたファイル</h4>
        <ul>{fileList}</ul>
      </aside>
      {previewArea}
    </section>
  );
};

export default Drop;