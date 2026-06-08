'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Locale = 'lo' | 'en';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const translations: Record<Locale, Record<string, string>> = {
  lo: {
    cart: "ກະຕ່າ",
    search: "ຄົ້ນຫາ",
    clear: "ລ້າງ",
    login: "ເຂົ້າສູ່ລະບົບ",
    register: "ລົງທະບຽນ",
    logout: "ອອກຈາກລະບົບ",
    order_history: "ປະຫວັດຄຳສັ່ງ",
    sell_product: "ຂາຍສິນຄ້າ",
    manage_shop: "ບໍລິຫານຮ້ານຂອງຂ້ອຍ",
    all_products: "ສິນຄ້າທັງໝົດ",
    sale_products: "ສິນຄ້າລົດລາຄາ",
    search_product_placeholder: "ຊື່ສິນຄ້າ...",
    category_all: "ທັງໝົດ",
    loading: "ກຳລັງໂຫຼດ...",
    confirm_purchase: "ຢືນຢັນການສັ່ງຊື້",
    total_amount: "ຍອດລວມ",
    quantity: "ຈຳນວນ",
    delete: "ລຶບ",
    shipping_address: "ທີ່ຢູ່ຈັດສົ່ງ",
    payment_method: "ວິທີຊຳລະ",
    cod: "ຊຳລະເມື່ອໄດ້ຮັບສິນຄ້າ (COD)",
    bank_transfer: "ໂອນເງິນຜ່ານທະນາຄານ",
    qr_code: "ຊຳລະຜ່ານ QR Code (ທະນາຄານລາວ)",
    order_details: "ລາຍລະອຽດຄຳສັ່ງ",
    payment_status: "ສະຖານະການຊຳລະ",
    order_status: "ສະຖານະຄຳສັ່ງຊື້",
    unpaid: "ຍັງບໍ່ທັນຊຳລະ",
    paid: "ຊຳລະແລ້ວ",
    pending: "ລໍຖ້າການຢືນຢັນ",
    confirmed: "ຢືນຢັນແລ້ວ",
    processing: "ກຳລັງກະກຽມ",
    shipped: "ຈັດສົ່ງແລ້ວ",
    delivered: "ລູກຄ້າໄດ້ຮັບສິນຄ້າ",
    order_success: "ສັ່ງຊື້ສຳເລັດ!",
    back_to_homepage: "ກັບໄປໜ້າຫຼັກ",
    refresh_latest: "ໂຫຼດຂໍ້ມູນລ່າສຸດ",
    print_label: "ພິມປ້າຍ",
    category: "ປະເພດສິນຄ້າ",
    search_input_label: "ຄົ້ນຫາສິນຄ້າ",
    products_left: "ສິນຄ້າຄົງເຫຼືອ",
    shop: "ຮ້ານ",
    select_option: "ເລືອກຕົວເລືອກ",
    add_to_cart: "ເພີ່ມໃສ່ກະຕ່າ",
    out_of_stock: "ສິນຄ້າໝົດ",
    buyer_feedback: "ຄຳຕິຊົມຈາກຜູ້ຊື້",
    write_feedback: "ຂຽນຄຳຕິຊົມ",
    buyer_name: "ຊື່ຜູ້ຊື້",
    buyer_phone: "ເບີໂທ",
    print_friendly_label: "ພິມປ້າຍຈັດສົ່ງ",
    from: "ຈາກ",
    to: "ຮັບ",
    address: "ທີ່ຢູ່",
    order_code: "ລະຫັດ",
    date: "ວັນທີ",
    print_btn: "ພິມ",
    close_btn: "ປິດ",
    view_details: "ເບິ່ງລາຍລະອຽດ",
    order_date: "ວັນທີສັ່ງ",
    no_orders: "ບໍ່ມີຄຳສັ່ງຊື້",
    search_orders_placeholder: "ຄົ້ນຫາຕາມຊື່ສິນຄ້າ...",
    bank_details_title: "ຊຳລະດ້ວຍ QR Code",
    bank_details_desc: "ສະແກນ QR ດ້ວຍແອັບທະນາຄານ ແລ້ວໃສ່ເລກອ້າງອິງ 6 ໂຕສຸດທ້າຍ.",
    ref_number_label: "ເບີໂທ - ເລກອ້າງອິງ",
    ref_number_placeholder: "ຕົວຢ່າງ: 0205511234-123456",
    skip_btn: "ຂ້າມ",
    confirm_ref_btn: "ຢືນຢັນ ເລກອ້າງອິງ",
    submitting_ref: "ກຳລັງສົ່ງ...",
    buyer_feedback_title: "ຂຽນຄຳຕິຊົມຂອງທ່ານ",
    rating_label: "ຄະແນນ",
    comment_label: "ຄຳເຫັນ",
    comment_placeholder: "ຂຽນປະສົບການ...",
    submit_feedback_btn: "ສົ່ງຄຳຕິຊົມ",
    cancel_btn: "ຍົກເລີກ",
    submit_report_btn: "ສົ່ງລາຍງານ",
    report_product_title: "ລາຍງານສິນຄ້ານີ້",
    report_modal_title: "ລາຍງານສິນຄ້າ",
    reason_label: "ເຫດຜົນ *",
    reason_placeholder: "ຕົວຢ່າງ: ສິນຄ້າປອມ, ຂາຍສິນຄ້າຜິດກົດໝາຍ",
    details_label: "ລາຍລະອຽດ (ຖ້າມີ)",
    details_placeholder: "ຂໍ້ມູນເພີ່ມເຕີມ...",
    submitting_btn: "ກຳລັງສົ່ງ...",
    empty_cart: "ກະຕ່າຂອງທ່ານຫວ່າງເປົ່າ",
    go_back_shopping: "ກັບໄປຊື້ສິນຄ້າ",
    cart_page_title: "ກະຕ່າສິນຄ້າ",
    payment_summary: "ສະຫຼຸບຍອດຊຳລະ",
    subtotal: "ລາຄາສິນຄ້າ",
    checkout_btn: "ດຳເນີນການຊຳລະ",
    checkout_page_title: "ຊຳລະຄ່າສິນຄ້າ",
    ordered_items: "ສິນຄ້າທີ່ສັ່ງ",
    input_shipping_address: "ກະລຸນາປ້ອນທີ່ຢູ່ຈັດສົ່ງ",
    placeholder_address: "ບ້ານ, ເມືອງ, ແຂວງ, ເບີໂທ",
    seller_orders_title: "ຄຳສັ່ງຊື້ຂອງຮ້ານ",
    filter_search: "ຄົ້ນຫາ (ສິນຄ້າ / ຜູ້ຊື້)",
    filter_start_date: "ວັນທີເລີ່ມ",
    filter_end_date: "ວັນທີສິ້ນສຸດ",
    filter_all_orders: "ສະຖານະຄຳສັ່ງທັງໝົດ",
    filter_all_payments: "ສະຖານະການຊຳລະທັງໝົດ",
    clear_filters: "ລ້າງຕົວກອງ",
    confirm_payment_btn: "ຢືນຢັນການຊຳລະ",
    pagination_prev: "ກ່ອນໜ້າ",
    pagination_next: "ຕໍ່ໄປ",
    no_products_found: "ບໍ່ພົບສິນຄ້າ",
    view_product: "ເບິ່ງ",
    more_products: "ໂຫຼດເພີ່ມເຕີມ"
  },
  en: {
    cart: "Cart",
    search: "Search",
    clear: "Clear",
    login: "Login",
    register: "Register",
    logout: "Logout",
    order_history: "Order History",
    sell_product: "Sell Products",
    manage_shop: "Manage Shop",
    all_products: "All Products",
    sale_products: "Sale Products",
    search_product_placeholder: "Search product...",
    category_all: "All",
    loading: "Loading...",
    confirm_purchase: "Confirm Purchase",
    total_amount: "Total Amount",
    quantity: "Quantity",
    delete: "Remove",
    shipping_address: "Shipping Address",
    payment_method: "Payment Method",
    cod: "Cash on Delivery (COD)",
    bank_transfer: "Bank Transfer",
    qr_code: "Bank Transfer via QR Code",
    order_details: "Order Details",
    payment_status: "Payment Status",
    order_status: "Order Status",
    unpaid: "Unpaid",
    paid: "Paid",
    pending: "Pending Confirmation",
    confirmed: "Confirmed",
    processing: "Preparing",
    shipped: "Shipped",
    delivered: "Delivered",
    order_success: "Order Placed Successfully!",
    back_to_homepage: "Back to Home",
    refresh_latest: "Refresh",
    print_label: "Print Label",
    category: "Category",
    search_input_label: "Search Products",
    products_left: "Available Stock",
    shop: "Shop",
    select_option: "Select Option",
    add_to_cart: "Add to Cart",
    out_of_stock: "Out of Stock",
    buyer_feedback: "Customer Feedback",
    write_feedback: "Write a Review",
    buyer_name: "Buyer Name",
    buyer_phone: "Phone",
    print_friendly_label: "Shipping Label",
    from: "From",
    to: "To",
    address: "Address",
    order_code: "Order ID",
    date: "Date",
    print_btn: "Print",
    close_btn: "Close",
    view_details: "View Details",
    order_date: "Order Date",
    no_orders: "No orders found",
    search_orders_placeholder: "Search by product name...",
    bank_details_title: "Payment via QR Code",
    bank_details_desc: "Scan QR with bank app and enter last 6 digits of reference number.",
    ref_number_label: "Phone - Ref Number",
    ref_number_placeholder: "e.g., 0205511234-123456",
    skip_btn: "Skip",
    confirm_ref_btn: "Confirm Reference",
    submitting_ref: "Submitting...",
    buyer_feedback_title: "Write Your Feedback",
    rating_label: "Rating",
    comment_label: "Comment",
    comment_placeholder: "Describe your experience...",
    submit_feedback_btn: "Submit Feedback",
    cancel_btn: "Cancel",
    submit_report_btn: "Submit Report",
    report_product_title: "Report this product",
    report_modal_title: "Report Product",
    reason_label: "Reason *",
    reason_placeholder: "e.g., Counterfeit, illegal goods",
    details_label: "Details (Optional)",
    details_placeholder: "Additional information...",
    submitting_btn: "Submitting...",
    empty_cart: "Your cart is empty",
    go_back_shopping: "Go Back Shopping",
    cart_page_title: "Shopping Cart",
    payment_summary: "Order Summary",
    subtotal: "Item Cost",
    checkout_btn: "Proceed to Checkout",
    checkout_page_title: "Checkout",
    ordered_items: "Ordered Items",
    input_shipping_address: "Please enter shipping address",
    placeholder_address: "Village, District, Province, Phone",
    seller_orders_title: "Shop Orders",
    filter_search: "Search (Product / Buyer)",
    filter_start_date: "Start Date",
    filter_end_date: "End Date",
    filter_all_orders: "All Order Status",
    filter_all_payments: "All Payment Status",
    clear_filters: "Clear Filters",
    confirm_payment_btn: "Confirm Payment",
    pagination_prev: "Previous",
    pagination_next: "Next",
    no_products_found: "No products found",
    view_product: "View",
    more_products: "Load More"
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('lo');

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale === 'lo' || savedLocale === 'en') {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string): string => {
    return translations[locale]?.[key] || translations['lo']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
