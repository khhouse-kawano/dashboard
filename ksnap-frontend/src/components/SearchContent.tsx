import React from 'react';
import { tagList } from './TagList'; // ⭐ tagListをインポート

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
  owner: string
};

type Props = {
  modalCategory: string;
  searchList: SearchList;
  setSearchList: React.Dispatch<React.SetStateAction<SearchList>>;
  area: string[];
  modalClose: () => void;
  initialize: () => void
};

const SearchContent = ({ modalCategory, searchList, setSearchList, area, modalClose, initialize }: Props) => {
  const handleCheckboxChange = (key: keyof SearchList, value: string) => {
    initialize();
    setSearchList(prev => {
      const currentArray = prev[key] as string[];
      const nextArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [key]: nextArray };
    });
    modalClose();
  };

  const Chip = ({
    label,
    isSelected,
    onClick
  }: {
    label: string;
    isSelected: boolean;
    onClick: () => void
  }) => (
    <label
      className="user-select-none"
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        backgroundColor: isSelected ? '#2b3a55' : '#f8f9fa',
        color: isSelected ? '#ffffff' : '#495057',
        border: `1px solid ${isSelected ? '#2b3a55' : '#dee2e6'}`,
        borderRadius: '50px',
        padding: '6px 16px',
        fontSize: '0.9rem',
        fontWeight: isSelected ? '600' : '400'
      }}
    >
      <input
        type="checkbox"
        className="d-none"
        checked={isSelected}
        onChange={onClick}
      />
      {label}
    </label>
  );

  return (
    <div className="container py-3 py-md-4" style={{ maxWidth: '800px' }}>
      {modalCategory === 'search' && (
        <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm" style={{ border: '1px solid #f0f2f5' }}>

          {/* ⭐ タグ検索（ドロップダウン）を一番上に追加 */}
          <div className="row mb-4 align-items-center border-bottom pb-3">
            <div className="col-12 col-md-3 mb-2 mb-md-0 text-md-end pe-md-4">
              <span className="fw-bold" style={{ color: '#6c757d', fontSize: '0.95rem' }}>タグ</span>
            </div>
            <div className="col-12 col-md-9">
              <select
                className="form-select text-secondary"
                style={{ borderRadius: '8px', border: '1px solid #dee2e6', maxWidth: '300px' }}
                value={searchList.tag[0]}
                onChange={(e) => {
                  const selectedTag = e.target.value;
                  if (selectedTag) {
                    setSearchList(prev => ({
                      ...prev,
                      tag: [selectedTag]
                    }));
                    modalClose();
                  }
                }}
              >
                <option value="">タグを選択してください</option>
                {tagList.map((item, index) => (
                  <option key={index} value={item.label}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row mb-4 align-items-center border-bottom pb-3">
            <div className="col-12 col-md-3 mb-2 mb-md-0 text-md-end pe-md-4">
              <span className="fw-bold" style={{ color: '#6c757d', fontSize: '0.95rem' }}>写真</span>
            </div>
            <div className="col-12 col-md-9">
              <div className="d-flex flex-wrap gap-2">
                {['内観', '外観'].map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    isSelected={searchList.detail.includes(item)}
                    onClick={() => {
                      handleCheckboxChange('detail', item);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="row mb-4 align-items-center border-bottom pb-3">
            <div className="col-12 col-md-3 mb-2 mb-md-0 text-md-end pe-md-4">
              <span className="fw-bold" style={{ color: '#6c757d', fontSize: '0.95rem' }}>カテゴリー</span>
            </div>
            <div className="col-12 col-md-9">
              <div className="d-flex flex-wrap gap-2">
                {['施工事例', 'オーナーズハウス', '完成見学会', 'モデルハウス'].map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    isSelected={searchList.category.includes(item)}
                    onClick={() => {
                      handleCheckboxChange('category', item);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="row mb-4 align-items-center border-bottom pb-3">
            <div className="col-12 col-md-3 mb-2 mb-md-0 text-md-end pe-md-4">
              <span className="fw-bold" style={{ color: '#6c757d', fontSize: '0.95rem' }}>階数</span>
            </div>
            <div className="col-12 col-md-9">
              <div className="d-flex flex-wrap gap-2">
                {['平屋', '2階建て', '3階建て'].map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    isSelected={searchList.plan.includes(item)}
                    onClick={() => handleCheckboxChange('plan', item)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="row mb-4 align-items-center border-bottom pb-3">
            <div className="col-12 col-md-3 mb-2 mb-md-0 text-md-end pe-md-4">
              <span className="fw-bold" style={{ color: '#6c757d', fontSize: '0.95rem' }}>見学</span>
            </div>
            <div className="col-12 col-md-9">
              <div className="d-flex flex-wrap gap-2">
                {['全て', '可能'].map((item) => {
                  const currentVal = searchList.url === '' ? '全て' : searchList.url;
                  return (
                    <Chip
                      key={item}
                      label={item}
                      isSelected={currentVal === item}
                      onClick={() => setSearchList(prev => ({
                        ...prev,
                        url: item === '全て' ? '' : '見学可能'
                      }))}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* エリア（県・市町村） */}
          <div className="row mb-2 align-items-center">
            <div className="col-12 col-md-3 mb-2 mb-md-0 text-md-end pe-md-4">
              <span className="fw-bold" style={{ color: '#6c757d', fontSize: '0.95rem' }}>エリア</span>
            </div>
            <div className="col-12 col-md-9">
              <div className="d-flex flex-column flex-sm-row gap-3">
                {/* 県セレクト */}
                <select
                  className="form-select text-secondary"
                  style={{ borderRadius: '8px', border: '1px solid #dee2e6', minWidth: '150px' }}
                  value={searchList.pref || '全て'}
                  onChange={(e) => setSearchList(prev => ({
                    ...prev,
                    pref: e.target.value === '全て' ? '' : e.target.value,
                    town: '' // 県が変わったら市町村をリセット
                  }))}
                >
                  {['全て', '鹿児島県', '宮崎県', '大分県', '熊本県', '佐賀県'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                {/* 市町村セレクト */}
                <select
                  className="form-select text-secondary"
                  style={{ borderRadius: '8px', border: '1px solid #dee2e6', minWidth: '150px' }}
                  value={searchList.town || '全て'}
                  onChange={(e) => setSearchList(prev => ({
                    ...prev,
                    town: e.target.value === '全て' ? '' : e.target.value
                  }))}
                  disabled={!searchList.pref}
                >
                  <option value="全て">{searchList.pref ? '全て' : '県を選択してください'}</option>
                  {Array.from(new Set(area)).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default SearchContent;