import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pvqcxaeqnymhckuqjssi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWN4YWVxbnltaGNrdXFqc3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTE1MTQsImV4cCI6MjA4NzkyNzUxNH0.Ay00U-1BS2U69w9bqYi9YgdC4YQzEcfPstHJgmRuSDU";

const supabase = createClient(supabaseUrl, supabaseKey);

const missingDataRows = `
21-Oct-25	BrookSource	Purna Dwivedi	No	Sick	Arth Patel	Sick Leave	1
26-Nov-25	Brooksource	Purna Dwivedi	Yes	Travelling to Home	Arth Patel	HD-Casual	0.5
05-Jan-26	Brooksource	Purna Dwivedi	No	Health Issue	Not Approved	LWP(Doc not Received)	1
21-Jan-26	Brooksource	Purna Dwivedi	no	Sick	Gaurav Rami	Sick Leave	1
22-Jan-26	Brooksource	Purna Dwivedi	no	Sick	Gaurav Rami	Sick Leave	1
29-Sep-25	Guardian	Rabin Namindla	Yes	Travelling hometown for Dushera 	Arth Patel	Casual Leave	1
30-Sep-25	Guardian	Rabin Namindla	Yes	Travelling hometown for Dushera 	Arth Patel	Casual Leave	1
01-Oct-25	Guardian	Rabin Namindla	Yes	Travelling hometown for Dusshera 	Arth Patel	Casual Leave	1
02-Oct-25	Guardian	Rabin Namindla	Yes	Travelling hometown for Dusshera 	Arth Patel	Casual Leave	1
03-Oct-25	Guardian	Rabin Namindla	Yes	Travelling hometown for Dusshera 	Arth Patel	Casual Leave	1
23-Feb-26	Guardian	Rabin Namindla	Yes	Father Health Issue	Arth Patel	Casual Leave	1
24-Feb-26	Guardian	Rabin Namindla	Yes	Father Health Issue	Arth Patel	Casual Leave	1
25-Feb-26	Guardian	Rabin Namindla	Yes	Father Health Issue	Arth Patel	Casual Leave	1
26-Feb-26	Guardian	Rabin Namindla	Yes	Father Health Issue	Arth Patel	Casual Leave	1
27-Feb-26	Guardian	Rabin Namindla	Yes	Father Health Issue	Arth Patel	Casual Leave	1
14-Jan-26	BrookSource	Rajeev Ranjan	No	health Certi	Not Approved	LWP	1
21-Jan-26	BrookSource	Rajeev Ranjan	No	Bus Issue	Not Approved	LWP	1
16-Feb-26	BrookSource	Rajeev Ranjan	Yes	paternity leave	Arth Patel	Casual Leave	1
17-Feb-26	BrookSource	Rajeev Ranjan	Yes	paternity leave	Arth Patel	Casual Leave	1
18-Feb-26	BrookSource	Rajeev Ranjan	Yes	paternity leave	Arth Patel	Casual Leave	1
19-Feb-26	BrookSource	Rajeev Ranjan	Yes	paternity leave	Arth Patel	Casual Leave	1
20-Feb-26	BrookSource	Rajeev Ranjan	Yes	paternity leave	Arth Patel	Casual Leave	1
08-Jan-25	BrookSource	Ramiz Karagathara	Yes	Casual Leave	Gaurav Rami	Casual Leave	1
20-Jan-25	BrookSource	Ramiz Karagathara	Yes	Casual Leave	Gaurav Rami	Casual Leave	1
31-Mar-25	BrookSource	Ramiz Karagathara	Yes	Eid	Gaurav Rami	Casual Leave	1
01-Apr-25	BrookSource	Ramiz Karagathara	Yes	Eid	Gaurav Rami	Casual Leave	1
02-Apr-25	BrookSource	Ramiz Karagathara	Yes	Eid	Gaurav Rami	Casual Leave	1
03-Apr-25	BrookSource	Ramiz Karagathara	Yes	Eid	Gaurav Rami	Casual Leave	1
04-Apr-25	BrookSource	Ramiz Karagathara	Yes	Eid	Gaurav Rami	Casual Leave	1
02-May-25	Brooksource	Ramiz Karagathara	No	Emergancy at home	Arth Patel	Casual Leave	1
09-May-25	BrookSource	Ramiz Karagathara	No	Personal Reason	Not Approved	LWP	1
27-May-25	Brooksource	Ramiz Karagathara	No	Sick	Arth Patel	Sick Leave	1
06-Jun-25	BrookSource	Ramiz Karagathara	Yes	Eid	Arth Patel	Casual Leave	1
05-Aug-25	BrookSource	Ramiz Karagathara	No	Cold & Fever	Arth Patel	Sick Leave	1
18-Aug-25	BrookSource	Ramiz Karagathara	Yes	Travelling Hometown	Arth Patel	Bonus	0
17-Nov-25	Brooksource	Ramiz Karagathara	No	Sick	Not Approved	LWP(Doc not Received)	1
25-Nov-25	Brooksource	Ramiz Karagathara	Yes	Travelling	Arth Patel	Casual Leave	1
26-Nov-25	Brooksource	Ramiz Karagathara	Yes	Travelling	Arth Patel	Casual Leave	1
09-Jan-26	Brooksource	Ramiz Karagathara	No	Health Issue	Gaurav Rami	Sick Leave	1
05-Feb-26	BrookSource	Ramiz Karagathara	Yes	Brothers Marriage	Arth Patel	HD-Casual	0.5
06-Feb-26	BrookSource	Ramiz Karagathara	Yes	Brothers Marriage	Arth Patel	Casual Leave	1
02-May-25	BrookSource	Rekha Malkani	yes	Home Shifting	Arth Patel	Casual Leave	1
08-Jul-25	BrookSource	Rekha Malkani	No	Health Issue	Gaurav Rami	Sick Leave	1
21-Aug-25	BrookSource	Rekha Malkani	No	Family Emergency	Arth Patel	Bonus	0
22-Sep-25	BrookSource	Rekha Malkani	No	Sick	Arth Patel	Sick Leave	1
30-Sep-25	BrookSource	Rekha Malkani	Yes	Garba	Arth Patel	Casual Leave	1
12-Dec-25	Brooksource	Rekha Malkani	Yes	Family Marriage	Arth Patel	Casual Leave	1
17-Mar-25	BrookSource	Sachin Patle	No	No Update	Gaurav Rami	Casual Leave	1
31-Mar-25	BrookSource	Sachin Patle	No	Sick back Pain	Gaurav Rami	Sick Leave	1
01-Apr-25	BrookSource	Sachin Patle	No	Sick back Pain	Gaurav Rami	Sick Leave	1
28-Apr-25	BrookSource	Sachin Patle	Yes	Travelling to Hometown	Arth Patel	Casual Leave	1
29-Apr-25	BrookSource	Sachin Patle	Yes	Travelling to Hometown	Arth Patel	Casual Leave	1
30-Apr-25	BrookSource	Sachin Patle	Yes	Travelling to Hometown	Arth Patel	Casual Leave	1
01-May-25	BrookSource	Sachin Patle	Yes	Travelling to Hometown	Arth Patel	Casual Leave	1
02-May-25	BrookSource	Sachin Patle	Yes	Travelling to Hometown	Arth Patel	Casual Leave	1
05-May-25	BrookSource	Sachin Patle	No	Travelling to Hometown	Arth Patel	Casual Leave	1
06-May-25	BrookSource	Sachin Patle	No	Travelling to Hometown	Arth Patel	Casual Leave	1
07-May-25	BrookSource	Sachin Patle	No	Travelling to Hometown	Arth Patel	Casual Leave	1
08-May-25	BrookSource	Sachin Patle	No	Travelling to Hometown	Arth Patel	Casual Leave	1
09-May-25	BrookSource	Sachin Patle	No	Travelling to Hometown	Arth Patel	Casual Leave	1
16-Jun-25	BrookSource	Sachin Patle	No	Fever	Gaurav Rami	Sick Leave	1
29-Jul-25	BrookSource	Sachin Patle	No	Back Pain	Not Approved	LWP	1
08-Oct-25	BrookSource	Sachin Patle	No	Sick	Not Approved	LWP(Doc not Received)	1
21-Oct-25	BrookSource	Sachin Patle	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
22-Oct-25	BrookSource	Sachin Patle	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
23-Oct-25	BrookSource	Sachin Patle	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
24-Oct-25	BrookSource	Sachin Patle	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
20-Nov-25	BrookSource	Sachin Patle	No	WFH - Subs	Arth Patel	Casual Leave	1
21-Nov-25	BrookSource	Sachin Patle	No	WFH - Subs	Arth Patel	Casual Leave	1
24-Nov-25	BrookSource	Sachin Patle	No	WFH - Subs	Arth Patel	Casual Leave	1
25-Nov-25	BrookSource	Sachin Patle	No	WFH - Subs	Arth Patel	Casual Leave	1
26-Nov-25	BrookSource	Sachin Patle	No	WFH - Subs	Arth Patel	Casual Leave	1
05-Jan-26	Brooksource	Sachin Patle	No	Missed Bus	Not Approved	LWP	1
09-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
10-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
11-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
12-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
13-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
16-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
17-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
18-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
19-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
20-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
23-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
24-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
25-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
26-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
27-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
28-Feb-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
01-Mar-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
02-Mar-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
03-Mar-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
04-Mar-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
05-Mar-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
06-Mar-26	BrookSource	Sachin Patle	Yes	Marriage	Arth Patel	Casual Leave	1
29-Jan-24	Manpower	Satyam Singh	Yes	Travelling Home Town	Arth Patel	Casual Leave 	1
30-Jan-24	Manpower	Satyam Singh	Yes	Travelling Home Town	Arth Patel	Casual Leave 	1
31-Jan-24	Manpower	Satyam Singh	Yes	Travelling Home Town	Arth Patel	Casual Leave 	1
01-Feb-24	Manpower	Satyam Singh	Yes	Travelling Home Town	Arth Patel	Casual Leave 	1
02-Feb-24	Manpower	Satyam Singh	Yes	Travelling Home Town	Arth Patel	Casual Leave 	1
02-Aug-24	Manpower	Satyam Singh	No	Health Issue	Arth Patel	Sick Leave	1
09-Aug-24	Manpower	Satyam Singh	No	Health Issue	Arth Patel	Sick Leave	1
17-Mar-25	Manpower	Satyam Singh	No	Sick Leave	Arth Patel	Sick Leave	1
11-Apr-25	Manpower	Satyam Singh	Yes	Travelling for Pooja	Arth Patel	Casual Leave	1
26-May-25	Manpower	Satyam Singh	No	Sick Leave	Arth Patel	Sick Leave	1
26-Dec-25	Brooksource	Shirisha Nadiminti	No	stomach pain	Gaurav Rami	Sick leave	1
12-Jun-25	BrookSource	Smit Solanki	Yes	Family Function	Arth Patel	Casual Leave	1
13-Jun-25	BrookSource	Smit Solanki	Yes	Family Function	Arth Patel	Casual Leave	1
11-Sep-25	BrookSource	Smit Solanki	No	Met with Accident	Gaurav Rami	Sick Leave	1
12-Sep-25	BrookSource	Smit Solanki	No	Met with Accident	Gaurav Rami	Sick Leave	1
19-Nov-25	Brooksource	Smit Solanki	No	Sick	Arth Patel	Sick Leave	1
09-Feb-26	BrookSource	Smit Solanki	Yes	Marriage	Arth Patel	Casual Leave	1
10-Feb-26	BrookSource	Smit Solanki	Yes	marriage	Arth Patel	Casual Leave	1
11-Feb-26	BrookSource	Smit Solanki	Yes	marriage	Arth Patel	Casual Leave	1
12-Feb-26	BrookSource	Smit Solanki	Yes	marriage	Arth Patel	Casual Leave	1
13-Feb-26	BrookSource	Smit Solanki	Yes	marriage	Arth Patel	Casual Leave	1
20-Feb-26	BrookSource	Smit Solanki	Yes	marriage	Arth Patel	Casual Leave	1
03-Jun-25	FPG	Sonali Patel	Yes	Family Function	Arth Patel	Casual Leave	1
22-Sep-25	FPG	Sonali Patel	No	Sick Leave	Arth Patel	Sick Leave	1
23-Sep-25	FPG	Sonali Patel	No	Sick Leave	Arth Patel	Sick Leave	1
26-Nov-25	FPG	Sonali Patel	Yes	Travelling to Goa	Arth Patel	HD-Casual	0.5
01-Dec-25	FPG	Sonali Patel	Yes	Flight Delay	Arth Patel	HD-Casual	0.5
22-Aug-25	Guardian	Sonika Rishishwar	Yes	Family Function	Arth Patel	Casual Leave	1
05-Sep-25	Guardian	Sonika Rishishwar	No	Eye Infection 	Arth Patel	Sick Leave	1
21-Oct-25	Guardian	Sonika Rishishwar	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
22-Oct-25	Guardian	Sonika Rishishwar	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
23-Oct-25	Guardian	Sonika Rishishwar	Yes	Bus late	Arth Patel	HD-Casual	0.5
22-Oct-25	FPG	Taksh Pandya	Yes	Diwali	Arth Patel	Casual Leave	1
10-Dec-25	FPG	Taksh Pandya	No	Father Hospitalised	Arth Patel	Casual Leave	1
16-Jan-26	Brooksource	Unnati Pandya	No	Health Issue	Gaurav Rami	Sick Leave	1
19-Jan-26	BrookSource	Unnati Pandya	Yes	Sick	Gaurav Rami	Sick Leave	0.5
20-Jan-26	BrookSource	Unnati Pandya	Yes	Sick	Gaurav Rami	Sick Leave	1
26-Jan-26	BrookSource	Unnati Pandya	Yes	Sick	Gaurav Rami	Sick Leave	1
27-Jan-26	BrookSource	Unnati Pandya	No	Sick	Gaurav Rami	Sick Leave	1
28-Jan-26	BrookSource	Unnati Pandya	No	Sick	Gaurav Rami	Sick Leave	1
29-Jan-26	BrookSource	Unnati Pandya	No	Sick	Gaurav Rami	Sick Leave	1
30-Jan-26	BrookSource	Unnati Pandya	No	Sick	Gaurav Rami	Sick Leave	1
08-Jul-25	BrookSource	Urja Dave	No	Health Issues	Arth Patel	HD-Sick	0.5
15-Jul-25	BrookSource	Urja Dave	Yes	Family visit	Arth Patel	HD-Casual	0.5
05-Aug-25	BrookSource	Urja Dave	No	Food Poisoning	Not Approved	LWP	1
13-Aug-25	BrookSource	Urja Dave	No	Court Case	Arth Patel	Casual Leave	1
10-Sep-25	BrookSource	Urja Dave	No	Sick	Arth Patel	HD-Sick	0.5
12-Nov-25	Brooksource	Urja Dave	Yes	Personal Matter	Arth Patel	Casual Leave	1
17-Nov-25	Brooksource	Urja Dave	No	Sick	Arth Patel	Sick Leave	1
18-Nov-25	Brooksource	Urja Dave	No	Sick	Arth Patel	HD-Sick	0.5
04-Dec-25	Brooksource	Urja Dave	Yes	Personal Isssue	Arth Patel	Casual Leave	1
05-Dec-25	Brooksource	Urja Dave	Yes	Personal Isssue	Arth Patel	Casual Leave	1
27-Jan-26	BrookSource	Urja Dave	Yes	Personal Issues	Arth Patel	Casual Leave	1
04-Feb-26	BrookSource	Urja Dave	No	Health Issue	Gaurav Rami	HD-Sick	1
13-Feb-26	BrookSource	Urja Dave	Yes	out of Town	Arth Patel	HD-Casual	0.5
19-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
20-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
21-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
22-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
23-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
26-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
27-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
28-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
29-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
30-May-25	BrookSource	Vaishnavi Gaulkar	Yes	Exams	Arth Patel	Casual Leave	1
02-Sep-25	BrookSource	Vaishnavi Gaulkar	Yes	Travelling Home - Ganpati	Arth Patel	Casual Leave	1
03-Sep-25	BrookSource	Vaishnavi Gaulkar	Yes	Travelling Home - Ganpati	Arth Patel	Casual Leave	1
29-Oct-25	Brooksource	Vaishnavi Gaulkar	No	Sick	Not Approved	LWP(Doc not Received)	1
24-Nov-25	Brooksource	Vaishnavi Gaulkar	No	Family Emergency	Arth Patel	Casual Leave	1
25-Nov-25	Brooksource	Vaishnavi Gaulkar	No	Family Emergency	Arth Patel	Casual Leave	1
26-Nov-25	Brooksource	Vaishnavi Gaulkar	No	Family Emergency	Arth Patel	Casual Leave	1
12-Jan-26	Brooksource	Vaishnavi Gaulkar	No	Health Issue	Gaurav Rami	Sick Leave	1
13-Jan-26	Brooksource	Vaishnavi Gaulkar	No	Health Issue	Gaurav Rami	Sick Leave	1
14-Jan-26	Brooksource	Vaishnavi Gaulkar	No	Health Issue	Gaurav Rami	Sick Leave	1
14-Apr-25	BrookSource	Varshal Patel	Yes	Family Function	Arth Patel	Casual Leave	1
23-Apr-25	BrookSource	Varshal Patel	No	fever	Arth Patel	Sick Leave	1
14-Jul-25	BrookSource	Varshal Patel	No	Health Issues	Not Approved	LWP	1
18-Jul-25	BrookSource	Varshal Patel	No	out of city for personal work	Gaurav Rami	Casual leave	1
01-Oct-25	BrookSource	Varshal Patel	Yes	Navratri	Arth Patel	Casual Leave	1
24-Nov-25	Brooksource	Varshal Patel	Yes	Family Marriage	Arth Patel	Casual Leave	1
25-Nov-25	Brooksource	Varshal Patel	Yes	Family Marriage	Arth Patel	Casual Leave	1
26-Nov-25	Brooksource	Varshal Patel	Yes	Family Marriage	Arth Patel	Casual Leave	1
27-Feb-26	BrookSource	Varshal Patel	Yes	Family Gathering	Gaurav Rami	Casual Leave	1
18-Apr-25	BrookSource	Venu Sahadeva	No	Fever	Arth Patel	Sick Leave	1
07-Jul-25	BrookSource	Venu Sahadeva	No	Fever	Not Approved	LWP	1
22-Jul-25	BrookSource	Venu Sahadeva	No	PG Theft	Arth Patel	Casual leave	1
23-Jul-25	BrookSource	Venu Sahadeva	No	PG Theft	Arth Patel	Casual leave	1
17-Oct-25	BrookSource	Venu Sahadeva	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
21-Oct-25	BrookSource	Venu Sahadeva	Yes	Traveling to Hometown/ Diwali	Arth Patel	Casual Leave	1
22-Oct-25	BrookSource	Venu Sahadeva	No	Traveling to Hometown/ Diwali	Not Approved	LWP (Not approved)	1
23-Oct-25	BrookSource	Venu Sahadeva	No	Traveling to Hometown/ Diwali	Not Approved	LWP (Not approved)	1
24-Oct-25	BrookSource	Venu Sahadeva	No	Traveling to Hometown/ Diwali	Not Approved	LWP (Not approved)	1
12-Jan-26	Brooksource	Venu Sahadeva	No	Health Issue	Gaurav Rami	Sick Leave	1
13-Jan-26	Brooksource	Venu Sahadeva	No	Health Issue	Gaurav Rami	Sick Leave	1
14-Jan-26	Brooksource	Venu Sahadeva	No	Health Issue	Gaurav Rami	Sick Leave	1
26-Jan-26	BrookSource	Venu Sahadeva	No	Personal Issues	Arth Patel	Casual Leave	1
11-Feb-26	BrookSource	Venu Sahadeva	No	Health Issue	Not Approved	LWP (Documents not received)	1
17-Feb-26	BrookSource	Venu Sahadeva	No	Did not get up	Not Approved	LWP	1
21-May-25	HPP Staffing	Vimal Kashyap	No	Sick Leave	Arth Patel	HD-Sick	0.5
12-Sep-25	HPP Staffing	Vimal Kashyap	Yes	Family Function	Arth Patel	Casual Leave	1
10-Oct-25	HPP Staffing	Vimal Kashyap	Yes	Family Emergency	Arth Patel	Casual Leave	1
25-Nov-25	HPP Staffing	Vimal Kashyap	Yes	Family Marriage	Arth Patel	Casual Leave	1
26-Nov-25	HPP Staffing	Vimal Kashyap	Yes	Family Marriage	Arth Patel	Casual Leave	1
05-Dec-25	HPP Staffing	Vimal Kashyap	No	Sick	Not Approved	LWP(Doc not Received)	1
11-Dec-25	HPP Staffing	Vimal Kashyap	No	Sick	Arth Patel	Sick Leave	1
12-Jan-26	HPP Staffing	Vimal Kashyap	Yes	Travelling to Home	Arth Patel	Casual Leave	1
13-Jan-26	HPP Staffing	Vimal Kashyap	Yes	Travelling to Home	Arth Patel	Casual Leave	1
14-Jan-26	HPP Staffing	Vimal Kashyap	Yes	Travelling to Home	Arth Patel	Casual Leave	1
15-Jan-26	HPP Staffing	Vimal Kashyap	Yes	Travelling to Home	Arth Patel	Casual Leave	1
16-Jan-26	HPP Staffing	Vimal Kashyap	Yes	Travelling to Home	Arth Patel	Casual Leave	1
12-Jan-26	Guardian	Yeshwi Saxena	No	Travel	Not Approved	LWP	1
`.trim();

async function run() {
    const lines = missingDataRows.split('\n');
    console.log(`Processing ${lines.length} lines`);

    const clientSet = new Set<string>();
    const userMap = new Map<string, string>();
    const inserts = [];

    const monthMap: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length < 8) continue;

        let [dateStrRaw, client, name, plannedRaw, reason, approver, type, countRaw] = cols;
        client = client.trim();
        name = name.trim();

        if (client.toLowerCase() === 'brooksource') client = 'Brooksource';

        clientSet.add(client);
        userMap.set(name, client);

        const parts = dateStrRaw.trim().split('-'); // e.g. 29-Jan-24
        if (parts.length < 3) continue;
        const day = parts[0].padStart(2, '0');
        const month = monthMap[parts[1]] || '01';
        let year = parts[2];
        if (year.length === 2) year = '20' + year;

        const dateStr = `${year}-${month}-${day}`;

        let isPlanned = true;
        if (plannedRaw.toLowerCase().trim() === 'no') isPlanned = false;

        let dayCount = parseFloat(countRaw.trim());
        if (isNaN(dayCount)) dayCount = 1;

        inserts.push({
            client_name: client,
            employee_name: name,
            leave_type: type.trim(),
            is_planned: isPlanned,
            reason: reason.trim(),
            approver: approver.trim(),
            day_count: dayCount,
            date: dateStr,
        });
    }

    // Ensure users and clients
    for (const c of clientSet) {
        await supabase.from('clients').insert([{ name: c }]).select();
    }
    for (const [uName, uClient] of userMap.entries()) {
        await supabase.from('users').insert([{ name: uName, client_name: uClient, is_approved: true }]);
    }

    let successCount = 0;
    // We do upsert or insert to be safe if a row was half-present
    for (const row of inserts) {
        // Checking if exactly matching row exists first
        const { data: existing } = await supabase
            .from('leaves')
            .select('id')
            .eq('employee_name', row.employee_name)
            .eq('date', row.date)
            .eq('leave_type', row.leave_type)
            .eq('reason', row.reason);

        if (existing && existing.length > 0) {
            // Already there
            successCount++;
            continue;
        }

        const { error } = await supabase.from('leaves').insert([row]);
        if (error) {
            console.error(`Failed to insert for ${row.employee_name} on ${row.date}`, error.message);
        } else {
            successCount++;
        }
    }
    console.log(`Successfully processed ${successCount} / ${inserts.length} leaves from the new batch.`);
}

run().catch(console.error);
