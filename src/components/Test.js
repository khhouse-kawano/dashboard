import React ,{ useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation, useNavigate } from "react-router-dom";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import Card from 'react-bootstrap/Card';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

  // 開発用
  // import { info } from './info.js'

const Test = () => {
  const [ detailLength, setDetailLength ] = useState({});
  const [info, setInformation] = useState([]);
  const [files, setFiles] = useState([]);
  const [titleValidation, setTitleValidation] = useState(false);
  const [forumValidation, setForumValidation] = useState(false);
  const [posterValidation, setPosterValidation] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: useCallback(acceptedFiles => {
      setFiles(prevFiles => [
        ...prevFiles,
        ...acceptedFiles.map(file => Object.assign(file, {
          preview: URL.createObjectURL(file)
                  }))
                ]);
              },
            []),
          });

  useEffect(() =>{
    const fetchData = async() =>{
        try {
            const response = await axios.post("/home/api/information.php");
            setInformation(response.data);
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };
    fetchData();
},[]);

  const detail_show = async (index, valueLength) =>{
    setDetailLength(prevState =>({
...prevState, [index]:prevState[index] === valueLength ? 50 : valueLength,
    }));
  };

  const [show, setShow] = useState(false);
  const [imgShow, setImgShow] = useState(false);
  const [forum, setForum] = useState("");
  const [title, setTitle] = useState("");
  const [poster, setPoster] = useState("");
  const [id, setId] = useState("");
  const [article, setArticle] = useState(6);

  const handleClose = () => {
    setShow(false);
  };

  const handleAdd = async() => {

    const formData = new FormData();
    if ( title === "" ){
      setTitleValidation(true);
      return;
    } else {
      setTitleValidation(false);
    }

    if ( forum === "" ){
      setForumValidation(true);
      return;
    } else {
      setForumValidation(false);
    }

    if( poster === "" ){
      setPosterValidation(true);
      return;
    } else {
      setPosterValidation(false);
    }

    formData.append("id", id);
    formData.append("title", title);
    formData.append("forum", forum);
    formData.append("poster", poster);

    files.forEach((file, index) =>{
      formData.append(`file_${index}`, file);
    })

    try {
      const response = await axios.post(
        "/home/api/setInformation.php",
        formData,
        { headers: { "Content-Type": "multipart/form-data", } }
        );
        setInformation(response.data.customers);

        console.log("成功:", response.data.customers);
      } catch (error) {
        console.error("エラー:", error);
      }

  setTitle("");
  setForum("");
  setFiles([]);
  setPoster("");
  setTitleValidation(false);
  setForumValidation(false);
  setPosterValidation(false);
  setShow(false);

};

  const handleShow = () => {
    setId("");
    setTitle("");
    setForum("");
    setFiles([]);
    setPoster("");
    setTitleValidation(false);
    setForumValidation(false);
    setPosterValidation(false);
    setShow(true);
  };

  const detail_edit =()=>{
  };

  const detail_delete =()=>{
  };



  
  const previewDelete =(fileName) =>{
    setFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
  };

  const fileList = files.map(file => (
      <div key={file.name}  className='col-3 position-relative'>
        <img src={file.preview} alt={file.name} className='w-100'/>
        <div className='preview-delete h4 text-secondary position-absolute' onClick={()=>previewDelete(file.name)}><i className="fa-solid fa-circle-xmark "></i></div>
      </div>
  ));

  const [modalImg, setModalImg] = useState('');

  const setModal = (img)=>{
    setImgShow(true);
    setModalImg(`./api${img}`);
  };

  const handleImgClose = () => setImgShow(false);
  
  const articleAdd =() =>{
    setArticle(article + 6 );
  };

  const articleReload =()=>{
    setArticle(6);
    const element = document.querySelector('.table_content');
    element.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchImageFile = async (fileUrl) => {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}`);
      const blob = await response.blob();
      return new File([blob], fileUrl.split('/').pop(), { type: blob.type });
    } catch (error) {
      console.error(`Error fetching file: ${fileUrl}`, error);
      return null; // 取得できなかった場合は null を返す
    }
  };
  
  const articleRewrite = async (id, title, forum, poster, imagePaths) => {
    setId(id);
    setTitle(title);
    setForum(forum);
    setPoster(poster);
  
    const imageFiles = await Promise.all(
      imagePaths.filter(img => img).map(async (img, index) => {
        const file = await fetchImageFile(`./api${img}`);
        if (!file) {
          console.warn(`Failed to fetch image: ./api${img}`);
          return null;
        }
        // File オブジェクトに preview プロパティを追加する
        file.preview = URL.createObjectURL(file);
        return file;
      })
    );
  
    // null を除外し、File オブジェクトが保管されるようにする
    setFiles(prevFiles => [...prevFiles, ...imageFiles.filter(file => file !== null)]);
    setShow(true);
  };

  const articleDelete = async (id, title) => {
    if (!window.confirm(`${title}のお知らせを削除しますか？`)) {
      console.log("キャンセルされました");
      return;
    }
  
    const formData = new FormData();
    formData.append("id", id);
  
    try {
      const response = await axios.post(
        "/dashboard/api/deleteInformation.php",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
  
      console.log("成功:", response.data.customers);
  
      setInformation(response.data.customers);
      
    } catch (error) {
      console.error("削除エラー:", error);
    }
  };

  return (
    <div className="container top bg-white m-5">
      <div className='d-lg-flex p-2 position-relative'>
        <div className='w-50'>
          <div className='row my-3'>
            <div className='col d-flex justify-content-center align-items-center text-center py-5 mx-2 bg-light'>
              <a href ="https://pg-cloud.jp/" target="_blank">
                <img src="https://pg-cloud.jp/assets/header-logo-012b9388b9456aeef73f19ab61bbf6343c44c08a66444954c435371ff3e72653.png" className='w-75'/>
              </a>
            </div>
            <div className='col d-flex justify-content-center align-items-center py-5 mx-2 bg-light'>
              <a href ="https://khg-marketing.info/dashboard/" target="_blank">
                <img src="https://khg-marketing.info/home/images/logo.png" className='w-100'/>
              </a>
            </div>
          </div>
          <div className='row mb-5'>
            <div className='col d-flex justify-content-center align-items-center py-5 mx-2 bg-light'>
              <a href ="https://khg-marketing.info/manual_pg/" target="_blank">
                <img src="https://khg-marketing.info/home/images/logo2.png" className='w-100'/>
              </a>
            </div>
            <div className='col d-flex justify-content-center align-items-center py-5 mx-2'>

            </div>
          </div>
        </div>
        <div className='w-50 p-5 table_content'>
          <h5 className='ps-2 py-3'>お知らせ一覧</h5>
          <div className='position-absolute post_content' onClick={handleShow} data-bs-target="#modal1"><i class="fa-solid fa-circle-plus text-primary"></i></div>
          {info.filter( item => item.list === 1).slice(0, article).map((info, index) =>(
          <Card className='mb-2 border-0 bg-light'>
            <Card.Body>
              <Card.Title>{info.title}</Card.Title>
                <Card.Subtitle className="mb-2 text-muted">{info.date}</Card.Subtitle>
                  <Card.Text>
                  {info.content.slice(0, detailLength[index] || 50).split('\n').map((line, lineIndex) => (
                    <React.Fragment key={lineIndex}>
                      {line.split(/(https?:\/\/[^\s]+)/g).map((part, partIndex) =>
                        /^https?:\/\/[^\s]+$/.test(part) ? (
                        <a key={partIndex} href={part} target="_blank">{part}</a>
                          ) : (
                          part))}
                        <br />
                    </React.Fragment>
                    ))}
                    {info.content.length > 50 && (
                    <span 
                      className="text-primary pointer info_icon" 
                      onClick={() => detail_show(index, info.content.length)}
                    >
                    {detailLength[index] === info.content.length ? " 閉じる" : " ... 続きを表示"}
                    </span>
                    )}
                    <div className='row'>
                      <div className='col'>{info.img_1  ? <img src={`./api${info.img_1}`} alt="画像" className='w-100 forum_img my-2' onClick={()=>setModal(info.img_1)} data-bs-target="#modal2"/>  : ""}</div>
                      <div className='col'>{info.img_2  ? <img src={`./api${info.img_2}`} alt="画像" className='w-100 forum_img my-2' onClick={()=>setModal(info.img_2)} data-bs-target="#modal2"/>  : ""}</div>
                    </div>
                    <div className='row'>
                      <div className='col'>{info.img_3  ? <img src={`./api${info.img_3}`} alt="画像" className='w-100 forum_img' onClick={()=>setModal(info.img_3)} data-bs-target="#modal2"/>  : ""}</div>
                      <div className='col'>{info.img_4  ? <img src={`./api${info.img_4}`} alt="画像" className='w-100 forum_img' onClick={()=>setModal(info.img_4)} data-bs-target="#modal2"/>  : ""}</div>
                    </div>
                  </Card.Text>
                  <Card.Link onClick={()=>articleRewrite(info.id, info.title, info.content, info.poster, [info.img_1,info.img_2,info.img_3,info.img_4])} className='pointer'>修正</Card.Link>
                  <Card.Link onClick={()=>articleDelete(info.id, info.title)} className='pointer'>削除</Card.Link>
                  <div className='row'>
                      <div className='col-7'></div>
                      <div className='col-5'>{info.poster}より</div>
                    </div>
            </Card.Body>
          </Card>
          ))}
          <div className='d-flex mt-3 justify-content-center'>
          {info.length > article ? <div className="text-center me-3">
              <div className='btn bg-light px-5 text-primary rounded-pill' onClick={()=>articleAdd()}>続きを表示</div>
            </div> : "" }
            <div className="text-center">
              <div className='btn bg-light px-5 text-primary rounded-pill' onClick={()=>articleReload()}>お知らせTop</div>
            </div>
          </div>
        </div>
      </div>
      <Modal show={show} onHide={handleClose} id="modal1" size="lg">
        <Modal.Header closeButton>
          <Modal.Title>お知らせを追加</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <input type='text' value={title} placeholder='タイトル' className='w-100 mb-2 rounded border-secondary form-control' onChange={(event)=>{
            setTitle(event.target.value);
            setTitleValidation(false);
            }}/>
          { titleValidation === true ? <div className='text-danger mb-2'>タイトルが入力されていません</div> : ""}
          <textarea rows={7} className='w-100 border-secondary rounded form-control mb-2 ' onChange={(event) =>{
            setForum(event.target.value);
            setForumValidation(false);
            }} placeholder='お知らせの内容'>{forum}</textarea>
          { forumValidation === true ? <div className='text-danger mb-2'>お知らせが入力されていません</div> : ""}    
          <div {...getRootProps({ className: 'dropzone border-secondary ' })}>
            <input {...getInputProps()} />
            <div className='bg-light p-5 text-secondary opacity-50 text-center'>画像をドラッグ＆ドロップまたはクリックして選択</div>
          </div>
          <aside className='mt-2'>
            <p>アップロードされたファイル</p>
            <div className='row'>{fileList}</div>
          </aside>
          <input type='text' value={poster} placeholder='投稿者' className='w-100 my-2 rounded border-secondary form-control' onChange={(event)=>{
            setPoster(event.target.value);
            setPosterValidation(false);
            }}/>
          { posterValidation === true ? <div className='text-danger mb-2'>投稿者名が入力されていません</div> : ""}    
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>handleClose()}>
            Close
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            記事を追加・修正
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={imgShow} onHide={handleImgClose} id="modal2" size="lg">
        <Modal.Body>
          <img src={modalImg} alt="画像" className='w-100 forum_img'/>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>handleImgClose()}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default Test