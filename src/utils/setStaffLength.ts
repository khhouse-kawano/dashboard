export const setStaffLength = (object: any, targetSection: string, section: string, shop: string, index: number) => {
    let value;
    if (!targetSection) {
        value = object.filter(item => (index >= 1 ? item.shop === shop : true));
    } else if (targetSection === 'all') {
        value = object.filter(item => (index >= 1 ? item.section === section : true));
    } else {
        value = object.filter(item => (index >= 1 ? item.shop === shop : item.section === targetSection));
    }
    return value;
};