from datetime import datetime, timedelta


def get_next_date(curr_date):
    return curr_date + timedelta(days=1)

def gen_data(start_date, end_date):
    rows = []
    while start_date <= end_date:
        dt_s = start_date.strftime('"%Y-%m-%d"')
        rows.append(['1', dt_s, '1', '20', '20'])
        rows.append(['1', dt_s, '2', '20', '20'])
        rows.append(['1', dt_s, '3', '10', '10'])
        rows.append(['2', dt_s, '1', '18', '18'])
        rows.append(['2', dt_s, '2', '18', '18'])
        rows.append(['2', dt_s, '3', '15', '15'])
        rows.append(['3', dt_s, '1', '25', '25'])
        rows.append(['3', dt_s, '2', '25', '25'])
        rows.append(['3', dt_s, '3', '25', '25'])

        start_date = get_next_date(start_date)

    return [",".join([str(idx), *data]) for idx, data in enumerate(rows, start=1)]


def main(file_name, start_date, end_date):
    data = gen_data(start_date, end_date)

    with open(file_name, "w") as file:
        file.write("aid,pid,appt_date,cal_time_id,quota,available_quota")
        file.write("\n")
        for row in data:
            file.write(row)
            file.write("\n")


if __name__ == '__main__':
    file_name = 'appointment_offer.csv'
    start_date = datetime(2021, 3, 1)
    end_date = datetime(2021, 5, 30)
    main(file_name, start_date, end_date)
