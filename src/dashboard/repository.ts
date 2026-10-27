import { DoctorModel } from "../models/doctor.js";
import { PatientModel } from "../models/patient.js";
import type { DashboardDateRange } from "./validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PatientCountPerDoctor {
  doctorId: string;
  doctorName: string;
  patientCount: number;
}

export interface DashboardDay {
  date: string;
  doctorsCreated: number;
  patientsCreated: number;
}

export interface DashboardSummary {
  totals: {
    doctors: number;
    patients: number;
  };
  patientsPerDoctor: PatientCountPerDoctor[];
  dateStatistics: {
    from: string;
    to: string;
    days: DashboardDay[];
  };
}

export interface DashboardRepository {
  getSummary(range: DashboardDateRange): Promise<DashboardSummary>;
}

interface DailyCount {
  _id: string;
  count: number;
}

function toCountMap(rows: DailyCount[]): Map<string, number> {
  return new Map(rows.map((row) => [row._id, Number(row.count)]));
}

function buildDailySeries(
  range: DashboardDateRange,
  doctorCounts: Map<string, number>,
  patientCounts: Map<string, number>
): DashboardDay[] {
  const days: DashboardDay[] = [];
  for (let time = range.from.getTime(); time < range.toExclusive.getTime(); time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({
      date,
      doctorsCreated: doctorCounts.get(date) ?? 0,
      patientsCreated: patientCounts.get(date) ?? 0
    });
  }
  return days;
}

export class MongooseDashboardRepository implements DashboardRepository {
  async getSummary(range: DashboardDateRange): Promise<DashboardSummary> {
    const createdAt = { $gte: range.from, $lt: range.toExclusive };
    const doctorDailyPipeline = [
      { $match: { createdAt } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const patientDailyPipeline = [
      { $match: { createdAt } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const [doctorTotal, patientTotal, perDoctorRows, doctorDaily, patientDaily] = await Promise.all([
      DoctorModel.countDocuments({}).exec(),
      PatientModel.countDocuments({}).exec(),
      DoctorModel.aggregate([
        {
          $lookup: {
            from: PatientModel.collection.name,
            let: { currentDoctorId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$doctorId", "$$currentDoctorId"] } } },
              { $count: "patientCount" }
            ],
            as: "patientStats"
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            patientCount: {
              $ifNull: [
                { $arrayElemAt: ["$patientStats.patientCount", 0] },
                0
              ]
            }
          }
        },
        { $sort: { name: 1, _id: 1 } }
      ]).exec(),
      DoctorModel.aggregate(doctorDailyPipeline).exec(),
      PatientModel.aggregate(patientDailyPipeline).exec()
    ]);

    const patientsPerDoctor = perDoctorRows.map((row: { _id: unknown; name: string; patientCount: number }) => ({
      doctorId: String(row._id),
      doctorName: row.name,
      patientCount: Number(row.patientCount)
    }));

    return {
      totals: {
        doctors: doctorTotal,
        patients: patientTotal
      },
      patientsPerDoctor,
      dateStatistics: {
        from: range.fromDate,
        to: range.toDate,
        days: buildDailySeries(range, toCountMap(doctorDaily as DailyCount[]), toCountMap(patientDaily as DailyCount[]))
      }
    };
  }
}
