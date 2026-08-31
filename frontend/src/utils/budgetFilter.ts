export const budgetFilter = (object: any, targetSection: string, shop: string, index) => {
    let value;
    if (targetSection && targetSection !== 'all') {
        value = object.filter(item => index >= 1 ? item.shop === shop : item.order_section === targetSection)
    } else if (targetSection === 'all') {
        value = object.filter(item => index >= 1 ? item.order_section === shop : true)
    } else {
        value = object.filter(item => index >= 1 ? item.shop === shop : true)
    }
    return value;
};