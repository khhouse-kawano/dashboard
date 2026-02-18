export const htmlValue = (customerObject: any, img: string, url: string, brand: string, staffObject: any ) => {
    return `<div style="padding:24px; font-family:Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif; color:#222; line-height:1.7; font-size:12px;">
                                <div style="width: 100%; margin: 0 0 30px 0;">
                                    <a  href="${customerObject?.mhl_url}" target="_blank"><img src=${img} style="width: 100%; margin: 0 auto"></a>
                                </div>
                                <p>${customerObject?.first_name ?? ''} ${customerObject?.last_name ?? ''} 様<br><br>
                        このたびは資料請求のお申込みをいただき、ありがとうございます。下記のアンケートにお答えいただくと、ご回答内容をもとに間取りをご提案いたします。まずはお気軽にお申し込みください！</p>
                            <a href="${customerObject?.mhl_url}" target="_blank"
                                style="display: block; border-radius:6px; padding:11px; background-color: #0b6cff; text-align: center; color: #fff; text-decoration: none; font-weight: bold; margin: 20px 0;">
                                アンケートに回答する
                            </a>
                      <p>店舗やモデルハウスでは、ライフスタイルに合わせたプラン・資金計画・土地のご提案も可能です。その他住まいづくりの相談に関するあらゆる疑問について、おうちづくりのプロである私たちが丁寧にお答えします。</p>
                      <div style="background-color:#fff7e6; padding: 10px"><strong style="color:#c15d00;">来場予約特典</strong><br>ご予約のうえご来場で<strong>20,000円分のギフトカード</strong>をプレゼント（毎月先着10名様）</div>
                            <a href="${url}" target="_blank"
                                style="display: block; border-radius:6px; padding:11px; background-color: #000000; text-align: center; color: #fff; text-decoration: none; font-weight: bold; margin: 20px 0 0 0;">
                                来場予約する
                            </a>
                      <p style="margin:12px 0 0 0; font-size:13px; color:#666;">特典内容は変更となる場合がございます。<br>特典進呈には条件がございますので予めご了承ください。</p>
                    <div style="padding:16px 24px; background-color:#f2f4f7; font-family:Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif; color:#555; font-size:12px; line-height:1.6;">
                  ${brand}｜MAIL ${staffObject?.mail}<br>
                  <span style='font-size: 11px'>お客様に入力して頂いた氏名・住所・電話番号・E-mailアドレス等の個人情報は今後、弊社もしくは関係会社において、弊社が出展または主催する展示会・セミナーのご案内、弊社が提供する商品・サービスに関するご案内など各種情報のご提供、及び弊社営業部門からのご連絡などを目的として利用させて頂きます。弊社は、ご提供いただいた個人情報を、法令に基づく命令などを除いて、あらかじめお客様の同意を得ないで第三者に提供することはありません。</span>
                </div>
                </div>`;
} 