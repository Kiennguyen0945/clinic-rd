| Trạng thái hiện tại | Trạng thái mới | Hành động UI                | Người thực hiện | Điều kiện / Ghi chú                                                                 |
|---------------------|----------------|-----------------------------|-----------------|-------------------------------------------------------------------------------------|
| (None)              | CONFIRMED      | Bấm nút "Tạo lịch"          | Lễ tân          | Đặt trước qua ĐT/Web. Sinh mã bookingCode + STT.                                    |
| (None)              | WAITING        | Bấm nút "Khám ngay"         | Lễ tân          | Bệnh nhân Walk-in tại quầy. Sinh mã + STT.                                          |
| CONFIRMED           | WAITING        | Bấm nút "Vào khám"          | Lễ tân          | Bệnh nhân đặt lịch đã có mặt tại quầy.                                              |
| WAITING             | IN_PROGRESS    | Bấm nút "Bắt đầu khám"      | Bác sĩ          | Bác sĩ gọi bệnh nhân vào phòng khám.                                                |
| IN_PROGRESS         | COMPLETED      | Bấm nút "Hoàn thành"        | Bác sĩ          | Khám xong, kê đơn xong.                                                             |
| WAITING             | CANCELLED      | Bấm nút "Hủy"               | Lễ tân          | Bệnh nhân đợi lâu quá bỏ về.                                                        |
| IN_PROGRESS         | CANCELLED      | Bấm nút "Hủy khám"          | Bác sĩ          | Bệnh nhân bỏ về giữa chừng hoặc có ca cấp cứu (Bắt buộc nhập lý do).                |
| CONFIRMED           | CANCELLED      | Auto-system                 | Cron Job        | Khách quá giờ hẹn mà không đến (Tự động quét và hủy).                               |


