export default function Privacy() {
  return (
    <main className="min-h-screen py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-sm text-gray-500 mb-8">อัปเดตล่าสุด: มิถุนายน 2568</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. ข้อมูลที่เราเก็บรวบรวม</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            เราเก็บรวบรวมข้อมูลที่คุณให้ไว้โดยตรง เช่น ชื่อ อีเมล และข้อมูลบัญชีธนาคาร
            รวมถึงข้อมูลที่ได้รับจากการเข้าสู่ระบบผ่าน Facebook เช่น ชื่อผู้ใช้และรูปโปรไฟล์
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. วัตถุประสงค์การใช้ข้อมูล</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            ข้อมูลของคุณถูกใช้เพื่อยืนยันตัวตน ดำเนินการลงทะเบียนผู้ขาย และอำนวยความสะดวก
            ในการทำธุรกรรมซื้อขายผ่านแพลตฟอร์ม Khonklang เท่านั้น
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. การเปิดเผยข้อมูล</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            เราไม่ขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนตัวของคุณแก่บุคคลภายนอก
            ยกเว้นกรณีที่จำเป็นตามกฎหมายหรือได้รับความยินยอมจากคุณ
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. การลบข้อมูล</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            คุณสามารถขอลบข้อมูลส่วนตัวของคุณได้ทุกเมื่อ โดยติดต่อเราที่{' '}
            <a href="mailto:runandyaow002@gmail.com" className="text-blue-500 underline">
              runandyaow002@gmail.com
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. ติดต่อเรา</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            หากมีคำถามเกี่ยวกับนโยบายนี้ กรุณาติดต่อ{' '}
            <a href="mailto:runandyaow002@gmail.com" className="text-blue-500 underline">
              runandyaow002@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
