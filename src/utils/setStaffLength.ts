import { thisYear } from "./thisYear";
const sections = {
    'order': ['鹿児島営業1課', '鹿児島営業2課', '鹿児島営業3課', '宮崎営業課', '熊本営業課', '大分・佐賀営業課',],
    'spec': ['不動産営業1課', '不動産営業2課']
};

export const setStaffLength = (object: any, targetSection: string, section: string, shop: string, index: number, category: string) => {
    const base = object.filter(o => o.period === String(thisYear) && sections[category].includes(o.section))
    let value;
    if (!targetSection) {
        value = base.filter(item => (index >= 1 ? item.shop === shop : true));
    } else if (targetSection === 'all') {
        value = base.filter(item => (index >= 1 ? item.section === section : true));
    } else {
        value = base.filter(item => (index >= 1 ? item.shop === shop : item.section === targetSection));
    }
    return value;
};