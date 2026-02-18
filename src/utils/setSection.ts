export const setSection = (object: any, targetSection: string, section: string, shop: string, index: number) => {
    let value;
    if (targetSection === 'all') {
         value = object.filter(item => index >= 1 ? item.section === section : true);
         } else {
             value = object.filter(item => index >= 1 ? item.shop === shop : true); }
    return value;
};