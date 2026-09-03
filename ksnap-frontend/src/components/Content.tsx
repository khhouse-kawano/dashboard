import './style.css';
import { useEffect, useState, useRef } from 'react';
import Logo from '../assets/images/logo.png';
import { Modal } from 'react-bootstrap';
import Thread from './Thread';
import HubContent from './HubContent';
import TagContent from './TagContent';
import SearchContent from './SearchContent';
import BookmarkContent from './BookmarkContent';
import { tagList } from './TagList';
import SettingContent from './SettingContent';
import axios from 'axios';
import { API_BASE, API_HEADERS } from '../config';
import { useNavigate, useLocation } from "react-router-dom";

type Photo = {
  id: string,
  image: string,
  note: string,
  url: string,
  detail: string,
  plan: string,
  pref: string,
  town: string,
  brand: string,
  category: string,
  shop: string,
  created_at: string,
  tag: string[],
  staff: string,
  staff_show: number,
  owner: string
};

type SearchList = {
  id: string[];
  image: string;
  note: string;
  url: string;
  detail: string[];
  plan: string[];
  large: string;
  pref: string;
  town: string;
  brand: string;
  event: boolean;
  category: string[];
  shop: string;
  staff: string;
  tag: string[];
  owner: string;
};

type Props = {
  customerData: Record<string, string>,
  handleBookmark: (id: string) => void,
  setCustomerData: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  mainCategory: string,
  setMainCategory: React.Dispatch<React.SetStateAction<string>>,
  viewCount: number,
  setViewCount: React.Dispatch<React.SetStateAction<number>>
};

export default function Content({ customerData, setCustomerData, handleBookmark, mainCategory, setMainCategory, viewCount, setViewCount }: Props) {
  const [photoList, setPhotoList] = useState<Photo[]>([]);
  const [filteredPhotoList, setFilteredPhotoList] = useState<Photo[]>([]);
  const [search, setSearch] = useState(false);
  const [modalCategory, setModalCategory] = useState('search');
  const [isSp, setIsSp] = useState<boolean>(window.innerWidth <= 768);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [wordList, setWordList] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [showLength, setShowLength] = useState(0);
  const [settingData, setSettingData] = useState<string>('');
  const [priorityTags, setPriorityTags] = useState<string[]>([]);
  const [categoryList, setCategoryList] = useState<string[]>([]);

  const id = params.get('id') ?? '';

  const safeParse = (value: string | string[] | any) => {
    if (typeof value === "string") return value;
    return '';
  };

  const pageParam = params.get('page') ?? 'tag';

  useEffect(() => {
    setMainCategory(pageParam);
    if (pageParam !== 'main' && pageParam !== 'focus') {
      initialize();
    };

    if (pageParam !== 'main' && pageParam !== 'search') {
      modalClose();
    }
  }, [pageParam]);

  useEffect(() => {
    if (!id || customerData.id) return;
    setCustomerData(prev => ({
      ...prev,
      id: id
    }));
  }, [id]);

  useEffect(() => {
    const settingLog = safeParse(localStorage.getItem('setting'));
    const displayLog = localStorage.getItem('display') ?? '';
    setSettingData(settingLog);
    setShowLength(displayLog.split(',').length);

    if (!customerData.id) {
      setCustomerData(prev => ({
        ...prev,
        setting: settingLog
      }))
    }

    if (!settingLog) {
      setModalCategory('setting');
      setSearch(true)
    };

    //APIからデータを取得
    const fetchData = async () => {
      const response = await axios.post(API_BASE, { request: 'k-snap' }, { headers: API_HEADERS });
      const safeData: Photo[] = response.data.snaps
        .sort((a: any, b: any) => {
          return b.id - a.id
        })
        .map((item: any) => {
          let parsedTag: string[] = [];

          try {
            const tmp = JSON.parse(item.tag);
            if (Array.isArray(tmp) && tmp.every(t => typeof t === "string")) {
              parsedTag = tmp;
            }
          } catch (e) {
            // JSON.parse エラー時は空配列のまま
          }

          return {
            id: String(item.id),
            detail: item.detail,
            category: item.category,
            plan: item.plan,
            pref: item.pref,
            town: item.town,
            brand: item.brand,
            shop: item.shop,
            note: item.note,
            tag: parsedTag,
            image: item.image,
            show_snap: item.show_snap,
            url: item.url,
            staff: item.staff,
            staff_show: Number(item.staff_show),
            owner: item.owner,
            created_at: item.created_at
          };
        });
      setPhotoList(safeData)
    };
    fetchData();

    const handleResize = () => {
      setIsSp(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
  }, [showLength, settingData]);

  const modalClose = () => {
    setSearch(false);
    setModalCategory('');
  };

  const [searchList, setSearchList] = useState<SearchList>({
    id: [],
    image: '',
    note: '',
    url: '',
    detail: [],
    plan: [],
    large: '',
    pref: '',
    town: '',
    brand: '',
    event: false,
    category: [],
    shop: '',
    staff: '',
    tag: [],
    owner: ''
  });

  const initialize = () => {
    setSearchList({
      id: [],
      image: '',
      note: '',
      url: '',
      detail: [],
      plan: [],
      large: '',
      pref: '',
      town: '',
      brand: '',
      event: false,
      category: [],
      shop: '',
      staff: '',
      tag: [],
      owner: ''
    });
  };

  useEffect(() => {
    if (!Array.isArray(photoList)) return;
    console.log(searchList)

    const filter = photoList.filter(p => {
      const conditions =
        (searchList.category.length > 0 ? searchList.category.some(t => p.category.includes(t)) : true) &&
        (searchList.detail.length > 0 ? searchList.detail.includes(p.detail) : true) &&
        (searchList.note ? p.note.includes(searchList.note) : true) &&
        (searchList.plan.length > 0 ? searchList.plan.includes(p.plan) : true) &&
        (searchList.url ? p.url : true) &&
        (searchList.pref ? p.pref === searchList.pref : true) &&
        (searchList.town ? p.town === searchList.town : true) &&
        (searchList.shop ? searchList.shop === p.shop : true) &&
        (searchList.owner ? searchList.owner === p.owner : true) &&
        (searchList.tag.length > 0 ? searchList.tag.some(t => p.tag.includes(t)) : true);
      return conditions;
    });
    setFilteredPhotoList(filter);

    const categoryCondition = [
      ...searchList.category,
      ...searchList.plan,
      ...searchList.detail,
      searchList.url,
      searchList.pref,
      searchList.town,
      searchList.shop,
      searchList.owner ? 'お施主様宅' : ''
    ].filter(item => item !== '');

    setCategoryList(categoryCondition);
  }, [searchList, photoList]);

  const [area, setArea] = useState<string[]>([]);

  useEffect(() => {
    if (!searchList.pref) return;
    const areaList = photoList.filter(p => p.pref === searchList.pref).map(p => p.town);
    setArea(areaList);
  }, [searchList]);

  const handleNavigate = (state: string) => {
    if (state === 'search') {
      setSearch(true);
      setModalCategory('search');
    }

    if (state === 'hub' || state === 'tag' || state === 'bookmark') {
      initialize();
    }

    if (!state) {
      navigate(customerData.id ? `/?id=${customerData.id}` : '/', { state: { fromTop: true } });
      return;
    }

    navigate(`/?page=${state === 'search' ? 'main' : state}${customerData.id ? `&id=${customerData.id}` : ''}`, { state: { fromTop: true } });
  };

  const iconStyle = (value: string | string[]) => {
    return {
      fontWeight: value.includes(mainCategory) ? 'bold' : '',
      color: value.includes(mainCategory) ? 'navy' : '',
      opacity: value.includes(mainCategory) ? '1' : '.5'
    }
  };

  // ⭐ 外枠（フェイクのINPUTコンテナ）のスタイル
  const inputContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #cccccc',
    borderRadius: '6px',
    backgroundColor: '#fff',
    padding: '2px 8px',
    width: isSp ? '60vw' : '50vw', // 横幅を少し調整
    minHeight: isSp ? '34px' : '40px'
  };

  // ⭐ 実際のINPUT要素のスタイル（透明・枠線なし）
  const searchStyle = {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    flex: '1',
    minWidth: '50px',
    fontSize: 'min( 4vw, 14px)'
  };

  // ⭐ INPUT内のタグ（ピル）スタイル
  const tagStyle = {
    backgroundColor: 'navy',
    color: '#fff',
    fontSize: 'min(3.5vw, 12px)',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '12px',
    marginRight: '6px',
    whiteSpace: 'nowrap' as 'nowrap',
    display: 'flex',
    alignItems: 'center',
    fontWeight: '500'
  };

  useEffect(() => {
    if (!searchValue) return;
    if (isTagSearch) {
      const tagValue = searchValue.replace('#', '');
      const filtered = tagList.filter(t => t.word.includes(tagValue) || t.label.includes(tagValue)).map(t => t.label);
      setWordList(filtered);
    }
    setSearchList(prev => ({
      ...prev,
      note: searchValue
    }));
  }, [searchValue]);

  const deleteCategory = (category: string) => {
    initialize();
    setMainCategory(category);
    setWordList([]);
  };

  const isTagSearch = searchValue.slice(0, 1) === '#';

  return (
    <>
      <style>
        {`
          .icon {
            position: relative;
            cursor: pointer;
          }

          /* -------------------------------------
             スマホ・基本設定（上中央・はみ出し対策）
          ------------------------------------- */
          .nav-tooltip {
            position: absolute;
            background-color: #2b3a55;
            color: #fff;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: all 0.25s ease;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            font-weight: 500;
            
            /* 基本は上中央 */
            bottom: calc(100% + 5px);
            left: 50%;
            transform: translateX(-50%);
          }

          /* 吹き出しのしっぽ（基本は下向き） */
          .nav-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 5px;
            border-style: solid;
            border-color: #2b3a55 transparent transparent transparent;
          }

          .icon:hover .nav-tooltip {
            opacity: 1;
            visibility: visible;
            bottom: calc(100% + 10px);
          }

          /* -------------------------------------
             PC表示時の設定（768px以上）
          ------------------------------------- */
          @media (min-width: 768px) {
            .nav-tooltip {
              top: calc(100% + 5px);
              bottom: auto;
              left: 50%;
              transform: translateX(0); /* 右方向に伸ばす */
            }

            .icon:hover .nav-tooltip {
              top: calc(100% + 10px);
              bottom: auto;
            }

            .nav-tooltip::after {
              top: auto;
              bottom: 100%;
              left: 15px; /* しっぽを左寄りに */
              transform: translateX(0);
              border-color: transparent transparent #2b3a55 transparent;
            }

            .nav-tooltip.edge-right {
              left: auto;
              right: 50%;
            }
            .nav-tooltip.edge-right::after {
              left: auto;
              right: 15px;
            }
          }

          /* -------------------------------------
             スマホ（767px以下）でも端のアイコンがはみ出ないようにする調整
          ------------------------------------- */
          @media (max-width: 767px) {
            .nav-tooltip.edge-left-sp {
              left: 0;
              transform: translateX(0);
            }
            .nav-tooltip.edge-left-sp::after {
              left: 15px;
              transform: translateX(0);
            }

            .nav-tooltip.edge-right-sp {
              left: auto;
              right: 0;
              transform: translateX(0);
            }
            .nav-tooltip.edge-right-sp::after {
              left: auto;
              right: 15px;
              transform: translateX(0);
            }
          }
        `}
      </style>

      <header className='bg-white py-2 shadow-sm' style={{ height: 'auto', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="d-flex justify-content-between px-3 align-items-center">
          <div className="d-flex align-items-center">
            {customerData.id && (
              <div className="me-2">
                <i className="fa-solid fa-magnifying-glass sp text-secondary" onClick={() => {
                  handleNavigate('search');
                }}></i>
              </div>
            )}
            <div className='ms-md-5 ps-md-3'>
              {/* ⭐ ここがフェイクの検索ボックス（この中にタグが入る） */}
              <div style={inputContainerStyle}>

                {/* 選択されたカテゴリー */}
                {categoryList.map((category, index) =>
                  <div style={tagStyle} key={`cat-${index}`}>
                    {category}
                    <span className='ms-2' style={{ cursor: 'pointer' }} onClick={() => deleteCategory('hub')}>×</span>
                  </div>
                )}

                {/* 選択された検索タグ */}
                {searchList.tag.map((word, wIndex) =>
                  <div key={`tag-${wIndex}`} style={tagStyle}>
                    #{word}
                    <span className='ms-2' style={{ cursor: 'pointer' }} onClick={() => {
                      deleteCategory('tag');
                    }}>×</span>
                  </div>
                )}

                {/* 実際のテキスト入力エリア（タグの右側に配置される） */}
                <div className="position-relative" style={{ flex: 1, display: 'flex' }}>
                  <input type="text"
                    placeholder={(categoryList.length > 0 || searchList.tag.length > 0) ? '' : 'タグ検索、フリーワード検索...'}
                    ref={inputRef}
                    style={searchStyle}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && searchValue === '') initialize();
                    }}
                  />
                  {/* サジェストのドロップダウン */}
                  {isTagSearch && (
                    <div className="position-absolute p-2 rounded shadow bg-white border"
                      style={{ top: 'calc(100% + 8px)', left: '0', zIndex: 1000, minWidth: '150px' }}>
                      {wordList.map((word, wIndex) =>
                        <div key={wIndex}
                          className='mb-1 rounded py-1 px-2' style={tagStyle}
                          onClick={() => {
                            initialize();
                            setSearchList(prev => ({
                              ...prev,
                              tag: [word]
                            }));
                            setMainCategory('main');
                            setSearchValue('');
                            if (!inputRef.current) return;
                            inputRef.current.value = '';
                          }}
                        >#{word}</div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => handleNavigate('')}>
            <img src={Logo} alt="K-Snap" style={{ height: '30px', objectFit: 'contain' }} />
          </div>
        </div>
      </header >

      {(mainCategory === 'main' || mainCategory === 'focus') &&
        <Thread filteredPhotoList={filteredPhotoList}
          setMainCategory={setMainCategory}
          mainCategory={mainCategory}
          searchList={searchList}
          setSearchList={setSearchList}
          customerData={customerData}
          setCustomerData={setCustomerData}
          handleBookmark={handleBookmark}
          priorityTags={priorityTags}
          setPriorityTags={setPriorityTags}
          handleNavigate={handleNavigate}
          viewCount={viewCount}
          setViewCount={setViewCount}
          isSp={isSp}
          initialize={initialize}
        />
      }
      {mainCategory === 'hub' && <HubContent photoList={photoList}
        filteredPhotoList={filteredPhotoList}
        setSearchList={setSearchList}
        handleNavigate={handleNavigate}
        customerData={customerData}
      />}
      {mainCategory === 'tag' && <TagContent photoList={photoList}
        filteredPhotoList={filteredPhotoList}
        setSearchList={setSearchList}
        customerData={customerData}
        setCustomerData={setCustomerData}
        priorityTags={priorityTags}
        setPriorityTags={setPriorityTags}
        handleNavigate={handleNavigate}
      />}
      {(mainCategory === 'bookmark' || mainCategory === 'focus_bookmark') && <BookmarkContent filteredPhotoList={filteredPhotoList}
        setMainCategory={setMainCategory}
        mainCategory={mainCategory}
        setSearchList={setSearchList}
        customerData={customerData}
        setCustomerData={setCustomerData}
        handleBookmark={handleBookmark}
      />}
      {mainCategory === 'setting' && <SettingContent
        customerData={customerData}
        setCustomerData={setCustomerData}
        modalClose={modalClose}
        setMainCategory={setMainCategory}
        mainCategory={mainCategory} />}

      <footer className='bg-white py-1 text-sm-center'>
        <div className="d-flex d-md-block justify-content-between px-2 py-1">
          <div className="icon">
            <span className="nav-tooltip edge-left-sp">タグ検索</span>
            <i className="fa-solid fa-hashtag" style={iconStyle('tag')}
              onClick={() => {
                handleNavigate('tag');
              }}></i>
          </div>
          <div className="icon">
            <span className="nav-tooltip">カテゴリー検索</span>
            <i className="fa-solid fa-camera"
              style={iconStyle('hub')} onClick={() => {
                handleNavigate('hub');
              }}></i>
          </div>
          <div className="icon">
            <span className="nav-tooltip">画像一覧</span>
            <i className="fa-solid fa-list" style={iconStyle(['main', 'focus'])}
              onClick={() => {
                handleNavigate('main');
              }}></i>
          </div>
          <div className="icon pc">
            <span className="nav-tooltip">画像検索</span>
            <i className="fa-solid fa-magnifying-glass"
              style={iconStyle('search')} onClick={() => {
                handleNavigate('search');
              }}></i>
          </div>
          {!customerData.id && <div className="icon">
            <span className="nav-tooltip">画像検索</span>
            <i className="fa-solid fa-magnifying-glass sp"
              style={iconStyle(['main', 'focus'])}
              onClick={() => {
                handleNavigate('search');
              }}></i>
          </div>}
          {customerData.id && <div className="icon">
            <span className="nav-tooltip">お気に入り</span>
            <i className="fa-regular fa-bookmark" style={iconStyle(['bookmark', 'focus_bookmark'])}
              onClick={() => {
                handleNavigate('bookmark');
              }}></i>
          </div>}
          <div className="icon">
            <span className="nav-tooltip edge-right-sp">検索設定</span>
            <i className="fa-regular fa-circle-user"
              style={iconStyle('setting')}
              onClick={() => {
                handleNavigate('setting');
              }}
            ></i>
          </div>
          {!customerData.id && <div className="icon">
            <span className="nav-tooltip edge-right edge-right-sp">ログイン</span>
            <i className="fa-solid fa-arrow-right-to-bracket"
              style={iconStyle('')}
              onClick={() => {
                navigate('/');
              }}
            ></i>
          </div>}
        </div>
      </footer>
      <Modal show={search} onHide={modalClose} size='xl'>
        <Modal.Header closeButton>写真を検索</Modal.Header>
        <Modal.Body>
          {modalCategory === 'search' && <SearchContent modalCategory={modalCategory} searchList={searchList} setSearchList={setSearchList} area={area} modalClose={modalClose} initialize={initialize} />}
          {modalCategory === 'setting' && <SettingContent customerData={customerData} setCustomerData={setCustomerData} modalClose={modalClose} mainCategory={mainCategory} setMainCategory={setMainCategory} />}
        </Modal.Body>
      </Modal>
    </>
  );
}