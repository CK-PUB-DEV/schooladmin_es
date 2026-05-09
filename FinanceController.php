<?php

namespace App\Http\Controllers\FinanceControllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use DB;
use App\FinanceModel;
use PDF;
use Dompdf\Dompdf;
use Session;
use Auth;
use Hash;


//version - 071320200205
//  -- Chart of Accounts

class FinanceController extends Controller
{
	public function index()
	{
		$glevelindex  = DB::table('gradelevel')
						->where('deleted', 0)
						->orderBy('sortid', 'asc')
						->get();

		// return $glevelindex ;

	if(count($glevelindex ) > 0)
		{
			foreach($glevelindex  as $glevel)
			{
				$tuitionheader = DB::table('tuitionheader')
					->where('levelid', $glevel->id)
					->where('deleted', 0)
					->get();
				if(count($tuitionheader) > 0)
				{
					$glevel->status = true;
				}
				else {
					$glevel->status = false;
				}

			}
		}

		// return $glevelindex ;
		return view('finance.index')->with('glevelindex', $glevelindex );
	}

	public function itemclassification()
	{
		return view('finance/itemclassification');
	}

	public function search_classification(Request $request)
	{
		if($request->ajax())
		{
			$sclass = $request->get('sclass');

			$classification = DB::table('itemclassification')
					->select('itemclassification.id','description', 'code', 'account', 'itemclassification.glid')
					->leftjoin('acc_coa', 'itemclassification.glid', 'acc_coa.id')
					->where('description', 'like', '%'.$sclass.'%')
					->where('itemclassification.deleted', 0)
					->orderBy('description', 'ASC')
					->get();

			// return $classification;
			$output = '';

			foreach($classification as $class)
			{
				$output .='
					<tr>
			            <td>'.$class->description.'</td>
			            <td>'.$class->code.' | '.$class->account.'</td>
			            <td>
			              	<div class="input-group">
				                <div class="input-group-prepend">
				                  <button class="btn btn-primary " id="btnclass-edit" data-id="'.$class->id.'" data-gl="'.$class->glid.'" data-toggle="modal" data-target="#modal-classification-edit">EDIT</button>
				                </div>
				                <div class="input-group-append">
				                    <button class="btn btn-danger" id="btndelete" data-id="'.$class->id.'">DELETE</button>
				               	</div>
			              	</div>
			            </td>
			       	</tr>
				';
			}

			$data = array(
				'output' => $output
			);

			echo json_encode($data);
		}
	}

	public function loadGL(Request $request)
	{
		if($request->ajax())
		{
			$glid = $request->get('glid');
			$glacc = db::table('acc_coa')
				->where('deleted', 0)
				->get();

			$output = '<option></option>';
			foreach($glacc as $gl)
			{
				if($glid == $gl->id)
				{
					$output .='
						<option value="'.$gl->id.'" selected>'.$gl->code.' | '.$gl->account.'</option>
					';
				}
				else
				{
					$output .='
						<option value="'.$gl->id.'">'.$gl->code.' | '.$gl->account.'</option>
					';
				}
			}

			$data = array(
				'output' =>$output
			);

			echo json_encode($data);
		}
	}

	public function saveClass(Request $request)
	{
		if($request->ajax())
		{
			$classdesc = $request->get('classdesc');
			$glid = $request->get('glid');

			$putClass = db::table('itemclassification')
					->insert([
						'description' => $classdesc,
						'glid' => $glid,
						'deleted' => 0,
						'createdby' => auth()->user()->id
					]);
		}
	}

	public function viewClass(Request $request)
	{
		if($request->ajax())
		{
			$classid = $request->get('classid');
			$glid = $request->get('glid');

			$getClass = db::table('itemclassification')
					->where('id', $classid)
					->where('deleted', 0)
					->first();

			$glacc = db::table('acc_coa')
					->where('deleted', 0)
					->get();

			$output = '<option></option>';

			foreach($glacc as $gl)
			{
				if($gl->id == $getClass->glid)
				{
					$output .='
						<option value="'.$gl->id.'" selected>'.$gl->code.' | '.$gl->account.'</option>
					';
				}
				else
				{
					$output .='
						<option value="'.$gl->id.'">'.$gl->code.' | '.$gl->account.'</option>
					';
				}
			}

			$data = array(
				'classid' => $getClass->id,
				'desc' => $getClass->description,
				'gl' => $output
			);

			echo json_encode($data);
		}
	}

	public function updateClass(Request $request)
	{
		if($request->ajax())
		{
			$classid = $request->get('classid');
			$desc = $request->get('desc');
			$glid = $request->get('glid');

			// return 'return' .$glid;

			$upd = db::table('itemclassification')
					->where('id', $classid)
					->update([
						'description' =>$desc,
						'glid' => $glid,
						'updatedby' => auth()->user()->id
					]);
		}
	}

	public function delClass(Request $request)
	{
		if($request->ajax())
		{
			$classid = $request->get('classid');

			$del = db::table('itemclassification')
					->where('id', $classid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

		}
	}

	public function payitems()
	{
		return view('finance/payitems');
	}

	public function payitemsearch(Request $request)
	{
		if($request->ajax())
		{
			$query = $request->get('query');

			$items = db::table('items')
					->select('items.id','itemcode', 'items.description as itemdescription', 'itemclassification.description as classdesc', 'items.amount', 'items_classcode.description as classcode')
					->leftjoin('itemclassification', 'items.classid', '=', 'itemclassification.id')
					->leftjoin('items_classcode', 'items.classcode', '=', 'items_classcode.id')
					->where(function($q) use($query){
						$q->where('itemcode', 'like', '%' . $query . '%')
							->orWhere('items.description', 'like', '%'. $query . '%');
					})
					->where('items.deleted', 0)
					->orderBy('items.description', 'asc')
					->get();
					

			// return $items;
			
			$output = '';
			$array=[];
			foreach($items as $item)
			{
				array_push($array, $item->itemdescription);
				$output .= '
					<tr data-id="'.$item->id.'">
			            <td>'.$item->itemcode.'</td>
			            <td>'.$item->itemdescription.'</td>
			            <td>'.$item->classdesc.'</td>
			            <td>'.$item->classcode.'</td>
			            <td>'.number_format($item->amount, 2).'</td>
		          </tr>
				';
			}

			$data = array(
				'output' => $output,
				'items' => $array
			);

			echo json_encode($data);
		}
	}
	
	public function loadNEW()
	{
		$classification = db::table('itemclassification')	
				->where('deleted', 0)
				->get();

		$output = '<option></option>';

		foreach($classification as $class)
		{
			$output .='
				<option value="'.$class->id.'">'.$class->description.'</option>				
			';
		}

		$data = array(
			'output' => $output
		);

		echo json_encode($data);
	}


	public function saveItem(Request $request)
	{
		if($request->ajax())
		{
			$itemcode = $request->get('itemcode');
			$itemdesc = $request->get('itemdesc');
			$classid = $request->get('classid');
			$amount = $request->get('amount');
			$slid = 0;
			$isdp = $request->get('isdp');
			$isreceivable = $request->get('isreceivable');
			$isexpense = $request->get('isexpense');

			$put = db::table('items')
					->insert([
						'itemcode' => $itemcode,
						'description' => $itemdesc,
						'classid' => $classid,
						'amount' => $amount,
						'isdp' => $isdp,
						'isreceivable' => $isreceivable,
						'isexpense' => $isexpense,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);


		}
	}

	public function loadEDIT(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');

			$get = db::table('items')
					->where('id', $itemid)
					->first();

			$itemcode = $get->itemcode;
			$itemdesc = $get->description;
			$amount = $get->amount;
			$isdp = $get->isdp;
			$isreceivable = $get->isreceivable;
			$isexpense = $get->isexpense;

			// return $isexpense;

			$loadClass = db::table('itemclassification')
					->where('deleted', 0)
					->orderBy('description', 'asc')
					->get();

			// $output = '<option></option>';
			$output = '';

			foreach($loadClass as $class)
			{
				if($class->id == $get->classid)
				{
					$output .='
						<option value="'.$class->id.'" selected>'.$class->description.'</option>
					';
				}
				else
				{
					$output .='
						<option value="'.$class->id.'">'.$class->description.'</option>
					';	
				}
			}

			$data = array(
				'classification' => $output,
				'itemcode' => $itemcode,
				'itemdesc' => $itemdesc,
				'amount' => $amount,
				'isdp' => $isdp,
				'isreceivable' => $isreceivable,
				'isexpense' => $isexpense
			);

			echo json_encode($data);

		}
	}

	public function updateItem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');
			$itemcode = $request->get('itemcode');
			$itemdesc = $request->get('itemdesc');
			$classid = $request->get('classid');
			$amount = $request->get('amount');
			$isdp = $request->get('isdp');
			$isreceivable = $request->get('isreceivable');


			$update = db::table('items')
					->where('id', $itemid)
					->update([
						'itemcode' => $itemcode,
						'description' => $itemdesc,
						'classid' => $classid, 
						'amount' => $amount,
						'isdp' => $isdp,
						'isreceivable' => $isreceivable
					]);
		}
	}

	public function deleteItem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');

			$del = db::table('items')
					->where('id', $itemid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);
		}
	}
	
	public function item_edit(Request $request)
	{
		$dataid = $request->get('dataid');

		$item = db::table('items')
			->where('id', $dataid)
			->first();

		$data = array(
			'id' => $item->id,
			'code' => $item->itemcode,
			'classcode' => $item->classcode,
			'description' => $item->description,
			'classid' => $item->classid,
			'amount' => $item->amount,
			'cash' => $item->cash,
			'receivable' => $item->isreceivable,
			'expense' => $item->isexpense,
			'glid' => $item->glid
		);

		echo json_encode($data);

	}
	
	public function item_update(Request $request)
	{
		$dataid = $request->get('dataid');
		$code = $request->get('code');
		$classcode = $request->get('classcode');
		$description = $request->get('description');
		$classid = $request->get('classid');
		$amount = $request->get('amount');
		$glid = $request->get('glid');
		$cash = $request->get('cash');
		$receivable = $request->get('receivable');
		$expense = $request->get('expense');

		if($dataid == 0)
		{
			$check =  db::table('items')
				->where('description', $description)
				->where('deleted', 0)
				->count();

			if($check > 0)
			{
				return 'exist';
			}
			else
			{
				db::table('items')	
					->insert([
						'itemcode' => $code,
						'classcode' => $classcode,
						'description' => $description,
						'classid' => $classid,
						'amount' => $amount,
						'glid' => $glid,
						'cash' => $cash,
						'isreceivable' => $receivable,
						'isexpense' => $expense,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

				return 'done';
			}
		}
		else
		{
			$check = db::table('items')
				->where('description', $description)
				->where('id', '!=', $dataid)
				->where('deleted', 0)
				->count();

			if($check > 0)
			{
				return 'exist';
			}
			else
			{
				db::table('items')
					->where('id', $dataid)
					->update([
						'itemcode' => $code,
						'classcode' => $classcode,
						'description' => $description,
						'classid' => $classid,
						'amount' => $amount,
						'glid' => $glid,
						'cash' => $cash,
						'isreceivable' => $receivable,
						'isexpense' => $expense,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

				return 'done';
			}
		}
	}

	public function modeofpayment()
	{
		return view('/finance/paymethod');
	}

	public function searchMOP(Request $request)
	{
		$query = $request->get('query');

		$paymethod = db::table('paymentsetup')
				->where('paymentdesc', 'like', '%' . $query . '%')
				->where('deleted', 0)
				->get();

		$output = '';
		$dp = '';
		foreach($paymethod as $method)
		{
			if($method->isdp == 1)
			{
				$dp = '<i class="fas fa-check"></i>';
			}
			else
			{
				$dp = '';
			}

			if($method->payopt == 'percentage')
			{
				$payopt = '<i class="fas fa-check"></i>';
			}
			else
			{
				$payopt = '';
			}

			$output .='
				<tr>
					<td>'.$method->paymentdesc.'</td>
					<td class="text-center">'.$method->noofpayment.'</td>
					<td class="text-center">'.$dp.'</td>
					<td class="text-center">'.$payopt.'</td>
					<td style="width:68px">
						<a href="/finance/mopedit/'.$method->id.'" class="btn btn-primary" data-toggle="tooltip" title="Edit">
							<i class="fas fa-edit"></i>
						</a>
					</td>
          <td>
          	<button class="btn btn-danger" id="btnmop-delete" data-id="'.$method->id.'" data-toggle="tooltip" title="Delete">
          		<i class="fas fa-trash"></i>
          	</button>
          </td>
				</tr>
			';
		}

		$data = array(
			'output' => $output
		);

		echo json_encode($data);


	}

	public function mopnew()
	{
		return view('finance/paymethodnew');
	}

	public function mopsave(Request $request)
	{
		if($request->ajax())
		{
			$desc = $request->get('desc');
			$duedates = $request->get('duedate');
			$noofpayment = $request->get('noofpayment');
			$isdp = $request->get('isdp');
			$paycount = 0;

			if($duedates == '')
			{
				$noofpayment = 1;
				$isdp = 1;
			}

			// return $duedates;

			$headerid = db::table('paymentsetup')
					->insertGetId([
						'paymentdesc' => $desc,
						'noofpayment' => $noofpayment,
						'isdp' => $isdp,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

			if($duedates != '')
			{
				foreach($duedates as $duedate)
				{
					$paycount += 1;
					$detail = db::table('paymentsetupdetail')
							->insert([
								'paymentid' => $headerid,
								'paymentno' => $paycount,
								'duedate' => $duedate['due'],
								'percentamount' => $duedate['pAmount'],
								'deleted' => 0,
								'createdby' => auth()->user()->id,
								'createddatetime' => FinanceModel::getServerDateTime()
							]);
				}
			}

			if($isdp == 1)
			{
				$chkdue = db::table('paymentsetupdetail')
						->where('paymentid', $headerid)
						->where('deleted', 0)
						->get();
						
				if(count($chkdue) == 0)
				{
					$putdue = db::table('paymentsetupdetail')
							->insert([
								'paymentid' => $headerid,
								'deleted' => 0
							]);
				}
			}
		}
	}

	public function mopedit(Request $request, $id)
	{
		$mop = db::table('paymentsetup')
				->where('deleted', 0)
				->where('id', $id)
				->first();



		$mopdetail = db::table('paymentsetupdetail')
				->where('paymentid', $mop->id)
				->where('deleted', 0)
				->get();

		$noofpayment = count($mopdetail);

		$mopupdate = db::table('paymentsetup')
				->where('id', $id)
				->update([
					'noofpayment' => $noofpayment
				]);

		
		$data = [
			'mop' => $mop,
			'mopdetail' => $mopdetail
		];

		return view("finance.paymethodedit")->with($data);
	}

	public function mopdetailSave(Request $request)
	{
		if($request->ajax())
		{
			$mopdid = $request->get('modid');

			$del = db::table('paymentsetupdetail')
					->update([
						'deleted' => 1,
						'deleteddatetime' => FinanceModel::getServerDateTime(),
						'deletedby' => auth()->user()->id
					]);
		}
	}

	public function mopdetailDel(Request $request)
	{
		if($request->ajax())
		{
			$mopdid = $request->get('mopdid');
			$headerid = $request->get('headerid');
			$noofpayment = $request->get('noofpayment');


			$del = db::table('paymentsetupdetail')
					->where('id', $mopdid)
					->update([
						'deleted' => 1,
						'deleteddatetime' => FinanceModel::getServerDateTime(),
						'deletedby' => auth()->user()->id
					]);

			$updHeader = db::table('paymentsetup')
					->where('id', $headerid)
					->update([
						'noofpayment' => $noofpayment
					]);
		}
	}

	public function mopdetailAdd(Request $request)
	{
		if($request->ajax())
		{
			$mopid = $request->get('mopid');
			
			$paycount = $request->get('paycount');
			$paymentno = $request->get('paymentno');
			$duedate = $request->get('duedate');
			$noofpayment = $request->get('noofpayment');
			
			$putData = db::table('paymentsetupdetail')
				->insert([
					'paymentid' => $mopid,
					'paymentno' => $paymentno,
					'duedate' => $duedate,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

			$updHeader = db::table('paymentsetup')
					->where('id', $mopid)
					->update([
						'noofpayment' => $noofpayment
					]);
		}
	}

	public function mopupdate(Request $request)
	{
		if($request->ajax())
		{
			$paydesc = $request->get('paydesc');
			$mopid = $request->get('mopid');
			$noofpayment = $request->get('noofpayment');
			$isdp = $request->get('isdp');
			$payopt = $request->get('payopt');

			// return $noofpayment;

			$updData = db::table('paymentsetup')
					->where('id', $mopid)
					->update([
						'paymentdesc' => $paydesc,
						'noofpayment' => $noofpayment,
						'isdp' => $isdp,
						'payopt' => $payopt,
						'updatedby' => auth()->user()->get(),
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

			if($isdp == 1)
			{
				$chkdue = db::table('paymentsetupdetail')
						->where('paymentid', $mopid)
						->where('deleted', 0)
						->get();
				if(count($chkdue) == 0)
				{
					$putdue = db::table('paymentsetupdetail')
							->insert([
								'paymentid' => $mopid,
								'deleted' => 0
							]);
				}
			}

		}
	}

	public function dueEdit(Request $request)
	{
		if($request->ajax())
		{
			$mopid = $request->get('mopid');
			$duedate = $request->get('duedate');

			$mop = db::table('paymentsetupdetail')
					->where('id', $mopid)
					->update([
						'duedate' => $duedate
					]);
		}
	}

	public function percentEdit(Request $request)
	{
		if($request->ajax())
		{
			$mopid = $request->get('mopid');
			$percentamount = $request->get('percentamount');

			$mop = db::table('paymentsetupdetail')
					->where('id', $mopid)
					->update([
						'percentamount' => $percentamount	
					]);
		}
	}

	public function mopdel(Request $request)
	{
		if($request->ajax())
		{
			$mopid = $request->get('mopid');

			$delMOP = db::table('paymentsetup')
					->where('id', $mopid)
					->update([
						'deleted' => 1,
						'deleteddatetime' => FinanceModel::getServerDateTime(),
						'deletedby' => auth()->user()->id
					]);

			$mopd = db::table('paymentsetupdetail')
					->where('paymentid', $mopid)
					->get();

			foreach($mopd as $del)
			{
				$mopddel = db::table('paymentsetupdetail')
						->where('id', $del->id)
						->update([
							'deleted' => 1,
							'deleteddatetime' => FinanceModel::getServerDateTime(),
							'deletedby' => auth()->user()->id
						]);
			}
		}
	}

	public function fees()
	{
		return view('finance.fees');
	}

	public function searchfees(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('sy');
			$semid = $request->get('sem');
			$levelid = $request->get('levelid');

			if($semid == '')
			{
				$semid = 1;
			}



			// return 'syid: ' . $syid . ' semid: ' . $semid . ' levelid: ' . $levelid; 
			$plan = db::table('schoolinfo')->first()->paymentplan;

			if($levelid != '')
			{
				$sFees = DB::table('tuitionheader')
					->select('tuitionheader.id', 'tuitionheader.description', 'grantee.description as grantee', 'sydesc', 'levelname', 'semester.semester', 'paymentplan')
					->join('sy', 'tuitionheader.syid', '=', 'sy.id')
					->join('gradelevel', 'tuitionheader.levelid', '=', 'gradelevel.id')
					->join('grantee', 'tuitionheader.grantee', '=', 'grantee.id')
					->leftjoin('semester', 'tuitionheader.semid', '=', 'semester.id')
					->where('syid', $syid)
					->where('semid', $semid)
					->where('levelid', $levelid)
					->where('tuitionheader.deleted', 0)
					->orderBy('gradelevel.sortid', 'asc')
					->orderBy('tuitionheader.description', 'asc')
					->get();
			}
			else
			{
				$sFees = DB::table('tuitionheader')
					->select('tuitionheader.id', 'tuitionheader.description', 'grantee.description as grantee', 'sydesc', 'levelname', 'semester.semester', 'paymentplan')
					->join('sy', 'tuitionheader.syid', '=', 'sy.id')
					->join('gradelevel', 'tuitionheader.levelid', '=', 'gradelevel.id')
					->join('grantee', 'tuitionheader.grantee', '=', 'grantee.id')
					->leftjoin('semester', 'tuitionheader.semid', '=', 'semester.id')
					->where('syid', $syid)
					->where('semid', $semid)
					// ->where('levelid', $levelid)
					->where('tuitionheader.deleted', 0)
					->orderBy('gradelevel.sortid', 'asc')
					->orderBy('tuitionheader.description', 'asc')
					->get();	
			}

			// return $sFees;

			$output = '';
			foreach($sFees as $fee)
			{

				$totalAmount = db::table('tuitiondetail')
						->where('headerid', $fee->id)
						->where('deleted', 0)
						->sum('amount');

				if($plan == 0)
				{
					$output .='
						<tr class="cursor-pointer" data-id="'.$fee->id.'">
							<td class="">'.$fee->description.'</td>
							<td class="">'.$fee->levelname.'</td>
							<td class="">'.$fee->sydesc.'</td>
							<td class="">'.strtoupper($fee->semester).'</td>
							<td class="">'.$fee->grantee.'</td>
							<td>'.number_format($totalAmount, 2).'</td>
							
						</tr>
					';
				}
				else
				{
					$output .='
					<tr class="cursor-pointer" data-id="'.$fee->id.'">
						<td class="">'.$fee->description.'</td>
						<td class="">'.$fee->paymentplan.'</td>
						<td class="">'.$fee->levelname.'</td>
						<td class="">'.$fee->sydesc.'</td>
						<td class="">'.strtoupper($fee->semester).'</td>
						<td class="">'.$fee->grantee.'</td>
						<td>'.number_format($totalAmount, 2).'</td>
						
					</tr>
				';
				}
			}


			$data = array(
				'fees' => $output
			);

			echo json_encode($data);

		}
	}

	public function feesnew()
	{
		$glevel = DB::table('gradelevel')
			->where('deleted', 0)
			->orderBy('sortid', 'asc')
			->get();

		$schoolyear = DB::table('sy')
			->orderBy('sydesc', 'asc')
			->get();

		$semester = db::table('semester')
			->get();

		$data = [
			'glevel' => $glevel,
			'schoolyear' =>$schoolyear,
			'semester' => $semester,
			'headerid' => 0
		];


		return view('finance.feesnew')
			->with($data);
	}

	public function loadClass(Request $request)
	{
		if($request->ajax())
		{
			$itemclass = db::table('itemclassification')
					->where('deleted', 0)
					->get();

			$output = '<option></option>';

			foreach($itemclass as $class)
			{
				$output .= '
					<option value="'.$class->id.'">'.$class->description.'</option>
				';
			}

			$payscheme = db::table('paymentsetup')
					->where('deleted', 0)
					->get();

			$scheme = '<option></option>';
			foreach($payscheme as $pay)
			{
				$scheme .='
					<option value = "'.$pay->id.'">'.$pay->paymentdesc.'</option>
				';
			}

			$data = array(
				'classification' => $output,
				'payscheme' => $scheme,
				'list' => $output  // Add for backward compatibility
			);

			echo json_encode($data);
		}
	}

	public function savePayClass(Request $request)
	{
		if($request->ajax())
		{
			$desc = $request->get('desc');
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$classID = $request->get('classID');
			$mopid = $request->get('mopid');
			$grantee = $request->get('grantee');
			$headid = $request->get('headid');

			$persubj = $request->get('persubj');
			$permop = $request->get('permop');
			$classmopid = $request->get('classmopid_mopid');

			if($semid == '')
			{
				$semid = 1;
			}

			if($levelid == 15 || $levelid == 14)
			{
				// $semid = $request->get('semid');
			}


			if($headid == 0)
			{
				$headerid = db::table('tuitionheader')
					->insertGetId([
						'description' => $desc,
						'syid' => $syid,
						'levelid' => $levelid,
						'grantee' => $grantee,
						'semid' => $semid,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				$headerid = $headid;
			}

			$putDetail = db::table('tuitiondetail')
				->insert([
					'headerid' => $headerid,
					'classificationid' => $classID,
					'pschemeid' => $mopid,
					'deleted' => 0,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

			$tuitiondetail = db::table('tuitiondetail')
				->select('tuitiondetail.id', 'itemclassification.description', 'paymentsetup.paymentdesc', 'tuitiondetail.amount')
				->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
				->join('paymentsetup', 'tuitiondetail.pschemeid', '=', 'paymentsetup.id')
				->where('headerid', $headerid)
				->where('tuitiondetail.deleted', 0)
				->get();


			$payClassList = FinanceModel::getFCPayClassList($headerid);



			$data = array(
				'headID' => $headerid,
				'tdetail' => $payClassList['tDetail'],
				'payclassamount' => $payClassList['pAmount']
			);

			echo json_encode($data);

		}
	}
	
	public function loadItems(Request $request)
	{
		if($request->ajax())
		{
			$items = db::table('items')
				->where('deleted', 0)
				->where('isreceivable', 0)
				->orWhere('deleted', 0)
				->get();

			$itemlist  = '<option></option>';

			foreach($items as $item)
			{
				$itemlist .= '
					<option value="'.$item->id.'">'.$item->description.'</option>
				';
			}

			$data = array(
				'itemlist' => $itemlist
			);

			echo json_encode($data);
		}
	}

	public function getItemInfo(Request $request)
	{
		if($request->ajax()){
			$itemid = $request->get('itemid');

			$item = db::table('items')
					->where('id', $itemid)
					->first();

			$itemAmount = $item->amount;

			return number_format($itemAmount, 2);
		}
	}

	public function saveFCItem(Request $request)
	{
		if($request->ajax()){
			$itemid = $request->get('itemid');
			$amount = $request->get('amount');
			$detailID = $request->get('detailID');
			$headerid = $request->get('headerid');

			$put = db::table('tuitionitems')		
					->insert([
						'tuitiondetailid' => $detailID,
						'itemid' => $itemid,
						'amount' => $amount,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

			$getDetail = db::table('tuitiondetail')
					->where('id', $detailID)
					->first();

			$curAmount = $getDetail->amount + $amount;

			$detailUPD = db::table('tuitiondetail')
					->where('id', $detailID)
					->update([
						'amount' => $curAmount
					]);


			$payclassTotal = FinanceModel::FCPayTotal($headerid);

			

			// $payTotal = db::select('select SUM(amount) as paytotal from tuitiondetail where headerid = ?', [$headerid]);

			// return $payTotal[0]->paytotal;

			$itemLayout = FinanceModel::getFCItemList($detailID);
			$itemTotal = FinanceModel::FCItemTotal($detailID);


			

			$data = array(
				'items' => $itemLayout,
				'itemTotal' => $itemTotal,
				'curAmount' => number_format($curAmount, 2),
				'payclassTotal' => $payclassTotal
			);

			echo json_encode($data);
		}
	}

	public function getFCItem(Request $request)
	{
		if($request->ajax())
		{
			$detailID = $request->get('detailID');

			$itemList = FinanceModel::getFCItemList($detailID);
			$itemTotal = FinanceModel::FCItemTotal($detailID);


			$data = array(
				'itemList' => $itemList,
				'itemTotal' => $itemTotal
			);

			echo json_encode($data);

		}
	}

	public function saveFC(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');
			$desc = $request->get('desc');
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$classID = $request->get('classID');
			$mopid = $request->get('mopid');
			$grantee = $request->get('grantee');
			$strandid = $request->get('strandid');
			$courseid = $request->get('courseid');
			$paymentplan = $request->get('paymentplan');

			if($semid == '' || $semid == 0)
			{
				$semid = 1;
			}
			
			if($levelid == 15 || $levelid == 14)
			{
				$semid = $request->get('semid');
			}

			if($levelid >= 17 && $levelid <= 21)
			{
				$semid = $request->get('semid');	
			}

			if($headerid > 0)
			{
				$updHeader = db::table('tuitionheader')
					->where('id', $headerid)
					->update([
						'description' => $desc,
						'syid' => $syid,
						'levelid' => $levelid,
						'grantee' => $grantee,
						'semid' => $semid,
						'strandid' => $strandid,
						'courseid' => $courseid,
						'paymentplan' =>$paymentplan,
						'deleted' => 0,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				$InsertHeader = db::table('tuitionheader')
					->insert([
						'description' => $desc,
						'syid' => $syid,
						'levelid' => $levelid,
						'grantee' => $grantee,
						'semid' => $semid,
						'strandid' => $strandid,
						'courseid' => $courseid,
						'paymenetplan' => $paymentplan,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);	
			}
		}
	}

	public function feesedit($id)
	{
		$headerid = $id;
		
		$glevel = DB::table('gradelevel')
			->where('deleted', 0)
			->orderBy('sortid', 'asc')
			->get();

		$schoolyear = DB::table('sy')
			->orderBy('sydesc', 'asc')
			->get();

		$semester = db::table('semester')
			->get();

		$data = [
			'glevel' => $glevel,
			'schoolyear' =>$schoolyear,
			'semester' => $semester,
			'headerid' => $headerid
		];

		return view('finance.feesedit')->with($data);

		// return $headerid;
	}

	public function editFC(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');

			$headerinfo = db::table('tuitionheader')
				->where('id', $headerid)
				->first();

			$payClassList = FinanceModel::getFCPayClassList($headerid);

			$data = array(
				'desc' => $headerinfo->description,
				'levelid' => $headerinfo->levelid,
				'syid' => $headerinfo->syid,
				'semid' => $headerinfo->semid,
				'grantee' => $headerinfo->grantee,
				'payDetail' => $payClassList['tDetail'],
				'payTotal' => $payClassList['pAmount'],
				'strand' =>$headerinfo->strandid,
				'courseid' => $headerinfo->courseid
			);

			echo json_encode($data);	

		}
	}

	public function updateFCpayclass(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');
			$detailid = $request->get('detailid');
			$classID = $request->get('classID');
			$mopid = $request->get('mopid');
			$isdp = $request->get('isdp');

			$persubj = $request->get('persubj');
			$permop = $request->get('permop');
			$classmopid = $request->get('classmopid_mopid');

			$upd = db::table('tuitiondetail')
					->where('id', $detailid)
					->update([
						'classificationid' => $classID,
						'pschemeid' => $mopid,
						'isdp' => $isdp,
						'persubj' => $persubj,
						'permop' => $permop,
						'permopid' => $classmopid,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			
			$payClassList = FinanceModel::getFCPayClassList($headerid);
			$itemList = FinanceModel::getFCItemList($detailid);
			$itemTotal = FinanceModel::FCItemTotal($detailid);

			// return $payClassList['pAmount'];

			echo json_encode($payClassList);
		}
		
	}
	
	public function deleteFCpayclass(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');
			$classID = $request->get('classID');

			$delClass = db::table('tuitiondetail')
					->where('id', $classID)
					->update([
						'deleted' => 1,
						'deleteddatetime' => FinanceModel::getServerDateTime(),
						'deletedby' => auth()->user()->id
					]);

			$tItemList = db::table('tuitionitems')
					->where('tuitiondetailid', $classID)
					->update([
						'deleted' => 1,
						'deleteddatetime' => FinanceModel::getServerDateTime(),
						'deletedby' => auth()->user()->id
					]);

			$payClassList = FinanceModel::getFCPayClassList($headerid);

			$data = array(
				'tDetail' => $payClassList['tDetail'],
				'pAmount' => $payClassList['pAmount'],
				'itemList' => FinanceModel::getFCItemList($classID),
				'itemTotal' => FinanceModel::FCItemTotal($classID)
			);

			echo json_encode($data);
		}
	}

	public function updateFCItem(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');
			$classID = $request->get('classID');
			$tItemID = $request->get('tItemID');
			$itemID = $request->get('itemID');
			$itemAmount = str_replace(',', '', $request->get('itemAmount'));


			$item = DB::table('tuitionitems')
					->where('id', $tItemID)
					->update([
						'itemid' => $itemID,
						'amount' => $itemAmount,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

			$itemList = FinanceModel::getFCItemList($classID);
			$itemTotal = FinanceModel::FCItemTotal($classID);


			$updAmount = db::table('tuitiondetail')
					->where('id', $classID)
					->update([
						'amount'=> str_replace(',', '', $itemTotal)
					]);


			$payclassList = FinanceModel::getFCPayClassList($headerid);
			
			$data = array(
				'tDetail' => $payclassList['tDetail'],
				'pAmount' => $payclassList['pAmount'],
				'itemList' => $itemList,
				'itemTotal' => $itemTotal
			);

			return $data;

			echo json_encode($data);


		}
	}

	public function deleteFCItem(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');
			$classID = $request->get('classID');
			$itemid = $request->get('itemid');

			$delItem = DB::table('tuitionitems')
					->where('id', $itemid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

			$itemList = FinanceModel::getFCItemList($classID);
			$itemTotal = FinanceModel::FCItemTotal($classID);

			$updClass = db::table('tuitiondetail')
					->where('id', $classID)
					->update([
						'amount' => str_replace(',', '', $itemTotal)
					]);

			$payClassList = FinanceModel::getFCPayClassList($headerid);
			

			$data = array(
				'tDetail' => $payClassList['tDetail'],
				'pAmount' => $payClassList['pAmount'],
				'itemList' => $itemList,
				'itemTotal' => $itemTotal
			);

			echo json_encode($data);
		}
	}

	public function feesdelete(Request $request)
	{
		if($request->ajax())
		{
			$pword = $request->get('pword');
			$auth = 0;
			if(Hash::check($pword, auth()->user()->password))
			{
				$auth = 1;
			}
			else
			{
				$auth = 0;
			}


			if($auth == 1)
			{
				$headerid = $request->get('headerid');

				$delHeader = db::table('tuitionheader')
						->where('id', $headerid)
						->update([
							'deleted' => 1,
							'deletedby' => auth()->user()->id,
							'deleteddatetime' => FinanceModel::getServerDateTime()
						]);

				$delDetail = db::table('tuitiondetail')
						->where('headerid', $headerid)
						->update([
							'deleted' => 1,
							'deletedby' => auth()->user()->id,
							'deleteddatetime' => FinanceModel::getServerDateTime()
						]);

				$getDetail = db::table('tuitiondetail')
						->where('headerid', $headerid)
						->get();


				foreach($getDetail as $detail)
				{
					$delItem = db::table('tuitionitems')
							->where('tuitiondetailid', $detail->id)
							->update([
								'deleted' => 1,
								'deletedby' => auth()->user()->id,
								'deleteddatetime' => FinanceModel::getServerDateTime()	
							]);
				}


				return 1;
			}
			else
			{
				return 0;
			}

		}
	}

	public function studledger()
	{
		return view('finance.studledger');
	}

	public function loadSY(Request $request)
	{
		if($request->ajax())
		{
			$schoolyear = db::table('sy')
					->get();

			$sydesc = '';

			foreach($schoolyear as $sy)
			{
				if($sy->isactive == 1)
				{	
						$sydesc .='
						<option value="'.$sy->id.'" selected>'.$sy->sydesc.'</option>
					';
				}
				else
				{
					$sydesc .='
						<option value="'.$sy->id.'">'.$sy->sydesc.'</option>
					';
				}
			}
			return $sydesc;
		}
	}

	public function searchStud(Request $request)
	{
		if($request->ajax())
		{
			$query = $request->get('query');

			$studlist = db::table('studinfo')
					->select('studinfo.id', 'lastname', 'firstname', 'middlename', 'suffix', 'levelid', 'gradelevel.levelname', 'sectionname', 'grantee.description as grantee', 'sid')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
					->where('lastname', 'like', '%'.$query.'%')
					->where('studinfo.deleted', 0)
					->orWhere('firstname', 'like', '%'.$query.'%')
					->where('studinfo.deleted', 0)
					->orWhere('lrn', 'like', '%'.$query.'%')
					->where('studinfo.deleted', 0)
					->orWhere('sid', 'like', '%'.$query.'%')
					->where('studinfo.deleted', 0)
					->orWhere('rfid', 'like', '%'.$query.'%')
					->where('studinfo.deleted', 0)
					->orderBy('lastname', 'asc')
					->orderBy('firstname', 'asc')
					->get();

			$list = '';
			$name ='';
			$esc = '';
			foreach($studlist as $stud)
			{
				$name = strtoupper($stud->lastname . ', ' . $stud->firstname . ' ' . $stud->middlename . ' ' . $stud->suffix .' | ' . $stud->levelname .' - ' . $stud->sectionname . ' | ' . $stud->grantee);

					$list .='
						<option value="'.$stud->id.'">'.$name.'</option>
					';

			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}


	public function getStudLedger(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('syid');
			$studid = $request->get('studid');
			$semid = $request->get('semid');
			$levelid = 0;
			$levelname = '';
			// $studstatus = 0;
			$strand = '';
			$section = '';
			$grantee = '';
			$studstat = '';
			$studstatus = 0;
			$list = '';
			$feesname = '';
			$feesid = 0;

			if($studid == 0)
			{
				goto end;
			}

			$info = db::table('studinfo')
					->where('id', $studid)
					->first();

			$tuitionheader = db::table('tuitionheader')
				->where('id', $info->feesid)
				->first();

			if($tuitionheader)
			{
				$feesname = $tuitionheader->description;
				$feesid = $tuitionheader->id;
			}

			$grntee = db::table('grantee')
				->where('id', $info->grantee)
				->first();

			if($grntee)
			{
				$grantee = $grntee->description;
			}


			$enrolled = db::table('enrolledstud')
				->where('studid', $studid)
				->where('syid', $syid)
				->where(function($q) use($semid){
					if($semid == 3)
					{
						$q->where('ghssemid', 3);
					}
					else
					{
						$q->where('ghssemid', '!=', 3);
					}
				})
				->where('deleted', 0)
				->first();

			if($enrolled)
			{
				$levelid = $enrolled->levelid;
				$levelname = db::table('gradelevel')->where('id', $levelid)->first()->levelname;	
				$studstatus = $enrolled->studstatus;

				$sec = db::table('sections')
					->where('id', $enrolled->sectionid)
					->first();

				if($sec)
				{
					$section = $sec->sectionname;
				}
			}
			else
			{
				$enrolled = db::table('sh_enrolledstud')
					->where('studid', $studid)
					->where('syid', $syid)
					->where(function($q) use($semid){
						if($semid == 3)
						{
							$q->where('semid', 3);
						}
						else
						{
							if(db::table('schoolinfo')->first()->shssetup == 0)
							{
								$q->where('semid', $semid);
							}
						}
					})
					->where('deleted', 0)
					->first();

				if($enrolled)
				{
					$levelid = $enrolled->levelid;
					$levelname = db::table('gradelevel')->where('id', $levelid)->first()->levelname;
					$studstatus = $enrolled->studstatus;

					$sec = db::table('sections')
					->where('id', $enrolled->sectionid)
					->first();

					if($sec)
					{
						$section = $sec->sectionname;
					}

					$strnd = db::table('sh_strand')
						->where('id', $enrolled->strandid)
						->first();

					if($strnd)
					{
						$strand = $strnd->strandcode;
					}
				}
				else
				{
					$enrolled = db::table('college_enrolledstud')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('semid', $semid)
						->where('deleted', 0)
						->first();

					if($enrolled)
					{
						$levelid = $enrolled->yearLevel;
						$levelname = db::table('gradelevel')->where('id', $levelid)->first()->levelname;
						$studstatus = $enrolled->studstatus;

						$sec = db::table('college_sections')
						->where('id', $enrolled->sectionID)
						->first();

						if($sec)
						{
							$section = $sec->sectionDesc;
						}
					}
					else
					{
						$levelid = $info->levelid;
						$levelname = db::table('gradelevel')->where('id', $levelid)->first()->levelname;
						$studstatus = 0;
					}
				}
			}

			

			$stat = db::table('studentstatus')
				->where('id', $studstatus)
				->first();

			if($stat)
			{
				$studstat = $stat->description;
			}

			// $levelid = $info->levelid;
			// $studstatus = $info->studstatus;


			if($levelid == 14 || $levelid == 15)
			{
				$getLedger = db::table('studledger')
					->where('studid', $studid)
					->where('syid', $syid)
					->where(function($q) use($semid){
						if(db::table('schoolinfo')->first()->shssetup == 0)
						{
							$q->where('semid', $semid);
						}
					})
					->where('deleted', 0)
					->orderBy('createddatetime', 'asc')
					->get();				
			}
			elseif($levelid >= 17 && $levelid <= 20)
			{
				$getLedger = db::table('studledger')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('semid', $semid)
					->where('deleted', 0)
					->orderBy('createddatetime', 'asc')
					->get();				
			}
			else
			{
				$getLedger = db::table('studledger')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('deleted', 0)
					->orderBy('createddatetime', 'asc')
					->get();
			}


			
			$bal = 0;
			$debit = 0;
			$credit = 0;
			
			foreach($getLedger as $led)
			{

				if($led->void == 0)
				{
					$debit += $led->amount;
			        $credit += $led->payment;
			    }
				

		        $lDate = date_create($led->createddatetime);
		        $lDate = date_format($lDate, 'm-d-Y');

		        if($led->amount > 0)
		        {
		          $amount = number_format($led->amount,2);
		        }
		        else
		        {
		          $amount = '';
		        }

		        if($led->payment > 0)
		        {
		          $payment = number_format($led->payment,2);
		        }
		        else
		        {
		          $payment = '';
		        }

		        if($led->void == 0)
		        {
        			$bal += $led->amount - $led->payment;

        			if(strpos($led->particulars, 'ADJ:') !== false)
        			{
        				$list .='
							<tr data-id="'.$led->id.'">
					          <td class="">' .$lDate.' </td>
					          <td>
					          	'.$led->particulars.' 
					          	<span class="text-sm text-danger adj_delete" style="cursor:pointer" data-id="'.$led->ornum.'">
					          		<i class="far fa-trash-alt"></i>
					          	</span>
					          </td>
					          <td class="text-right">'.$amount.'</td>
					          <td class="text-right">'.$payment.'</td>
					          <td class="text-right">'.number_format($bal, 2).'</td>
					        </tr>
						';
        			}
        			elseif(strpos($led->particulars, 'DISCOUNT:') !== false)
        			{
        				$list .='
							<tr data-id="'.$led->id.'">
					          <td class="">' .$lDate.' </td>
					          <td>
					          	'.$led->particulars.' 
					          	<span class="text-sm text-danger discount_delete" style="cursor:pointer" data-id="'.$led->ornum.'">
					          		<i class="far fa-trash-alt"></i>
					          	</span>
					          </td>
					          <td class="text-right">'.$amount.'</td>
					          <td class="text-right">'.$payment.'</td>
					          <td class="text-right">'.number_format($bal, 2).'</td>
					        </tr>
						';	
        			}
        			elseif(strpos($led->particulars, 'Balance forwarded from') !== false)
        			{
        				$list .='
							<tr data-id="'.$led->id.'">
					          <td class="">' .$lDate.' </td>
					          <td>
					          	'.$led->particulars.' 
					          	<span class="text-sm text-danger ledgeroa_delete" style="cursor:pointer" data-id="'.$led->id.'">
					          		<i class="far fa-trash-alt"></i>
					          	</span>
					          </td>
					          <td class="text-right">'.$amount.'</td>
					          <td class="text-right">'.$payment.'</td>
					          <td class="text-right">'.number_format($bal, 2).'</td>
					        </tr>
						';		
        			}
        			else
        			{
        				$list .='
							<tr class="">
					          <td class="">' .$lDate.' </td>
					          <td>'.$led->particulars.'</td>
					          <td class="text-right">'.$amount.'</td>
					          <td class="text-right">'.$payment.'</td>
					          <td class="text-right">'.number_format($bal, 2).'</td>
					        </tr>
						';
        			}

	        			
		        }
		        else
		        {
		        	$list .='
						<tr class="">
				          <td class="text-danger"><del>' .$lDate.' </del></td>
				          <td class="text-danger"><del>'.$led->particulars.'</del></td>
				          <td class="text-right text-danger"><del>'.$amount.'</del></td>
				          <td class="text-right text-danger"><del>'.$payment.'</del></td>
				          <td class="text-right text-danger"><del>'.number_format($bal, 2).'</del></td>
				        </tr>
						';	
		        }




    			//     		$bal += $led->amount - $led->payment;

				// $list .='
				// <tr class="">
				// 	<td class="">' .$lDate.' </td>
				// 	<td>'.$led->particulars.'</td>
				// 	<td class="text-right">'.$amount.'</td>
				// 	<td class="text-right">'.$payment.'</td>
				// 	<td class="text-right">'.number_format($bal, 2).'</td>
		  		//       </tr>
				// 	';
			}

			$list .= '
				<tr class="bg-primary">
					<th></th>
					<th style="text-align:right">
						<h5>
						  TOTAL:
						</h5>
					</th>
					<th class="text-right">
						<h5>
						  <u>'.number_format($debit, 2).'</u>
						</h5>
					</th>
					<th class="text-right">
						<h5>
						  <u>'.number_format($credit, 2).'</u>
						</h5>
					</th>
					<th class="text-right">
						<h5>
						  	<u>'.number_format($bal, 2).'</u>
						</h5>
					</th>
				</tr>
				';

			end:

			$data = array(
				'list' => $list,
				'levelid' => $levelid,
				'levelname' => $levelname,
				'studstatus' => $studstatus,
				'strand' => $strand,
				'section' => $section,
				'grantee' => $grantee,
				'studstatus' => $studstat,
				'feesname' => $feesname,
				'feesid' => $feesid
			);

			echo json_encode($data);
		}
	}
	
	public function printledger(Request $request)
	{
		$studid = $request->get('studid');
		$syid = $request->input('syid');

		$sinfo = db::table('schoolinfo')
				->first();



		$stud = db::table('studinfo')
				->select('studinfo.*', 'gradelevel.levelname')
				->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
				->where('studinfo.id', $studid)
				->first();

		// return $stud;

		$ledger = db::table('studledger')
					->where('studid', $studid)
          ->where('syid', $syid)
          ->where('deleted', 0)
          ->orderBy('id', 'asc')
          ->get();
		
		$curDate = date_create(FinanceModel::getServerDateTime());
		$curDate = date_format($curDate, 'm-d-Y h:i A');




		
		$pdf = PDF::loadview('finance.pdfledger', compact('stud', 'ledger', 'sinfo', 'curDate'));

		return $pdf->stream('studledger.pdf');
	}

	function ledgerPDF($studid, $syid)
	{


		$getLedger = db::table('studledger')
          ->where('studid', $studid)
          ->where('syid', $syid)
          ->where('deleted', 0)
          ->orderBy('id', 'asc')
          ->get();

			$list = '';
			$bal = 0;
      $debit = 0;
      $credit = 0;


      $list .='
      	<table class="table table-striped">
          <thead>
            <tr>
              <th>DATE</th>
              <th class="">PARTICULARS</th>
              <th class="text-center">CHARGES</th>
              <th class="text-center">PAYMENT</th>
              <th class="text-center">BALANCE</th>
            </tr>  
          </thead> 
          <tbody id="ledger-list">
      ';

			foreach($getLedger as $led)
			{

				$debit += $led->amount;
        $credit += $led->payment;
        $lDate = date_create($led->createddatetime);
        $lDate = date_format($lDate, 'm-d-Y');

        if($led->amount > 0)
        {
          $amount = number_format($led->amount,2);
        }
        else
        {
          $amount = '';
        }

        if($led->payment > 0)
        {
          $payment = number_format($led->payment,2);
        }
        else
        {
          $payment = '';
        }

        $bal += $led->amount - $led->payment;

				$list .='
					<tr class="">
	          <td class="">' .$lDate.' </td>
	          <td>'.$led->particulars.'</td>
	          <td class="text-right">'.$amount.'</td>
	          <td class="text-right">'.$payment.'</td>
	          <td class="text-right">'.number_format($bal, 2).'</td>
	        </tr>
				';
			}

			$list .='
					</tbody>
				</table>
			';

			return $list;
	}

	public function discounts()
	{
		return view('finance.discount');
	}

	public function discnew(Request $request)
	{
		if($request->ajax())
		{
			$particulars = $request->get('particulars');
			$amount = $request->get('amount');
			$percent = $request->get('percent');

			$insdata = db::table('discounts')
					->insert([
						'particulars' => $particulars,
						'amount' => $amount,
						'percent' => $percent,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
		}
	}

	public function discountSearch(Request $request)
	{
		if($request->ajax())
		{
			$lists = db::table('discounts')
					->where('deleted', 0)
					->orderBy('particulars', 'ASC')
					->get();

			$discounts = '';
			foreach($lists as $list)
			{
				$amount = '';

				if($list->percent == 0)
				{
					$amount = '₱ ' . number_format($list->amount, 2);
				}
				else
				{
					$amount = $list->amount . '%';
				}

				$discounts .='
					<tr data-id="'.$list->id.'" class="dList" style="cursor:pointer;">
            			<td>'.$list->particulars.'</td>
            			<td class="text-center">'.$amount.'</td>
          			</tr>
				';
			}

			$data = array(
				'lists' => $discounts
			);

			echo json_encode($data);
		}
	}

	public function discountedit(Request $request)
	{
		if($request->ajax())
		{
			$discid = $request->get('discID');

			$getDiscount = db::table('discounts')
					->where('id', $discid)
					->first();

			$data = array(
				'particulars' => $getDiscount->particulars,
				'percent' => $getDiscount->percent,
				'amount' => $getDiscount->amount
			);

			echo json_encode($data);
		}
	}

	public function discountupdate(Request $request)
	{
		if($request->ajax())
		{
			$particulars = $request->get('particulars');
			$amount = $request->get('amount');
			$percent = $request->get('percent');
			$discid = $request->get('discID');


			$upd = db::table('discounts')
					->where('id', $discid)
					->update([
						'particulars' => $particulars,
						'amount' => $amount,
						'percent' => $percent,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

		}
	}

	public function discountdelete(Request $request)
	{
		if($request->ajax())
		{
			$discid = $request->get('discID');

			$del = db::table('discounts')
					->where('id', $discid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);
		}
	}

	public function loadDiscClass(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			$studledger = db::table('studledger')
				->where('studid', $studid)
				->where('syid', FinanceModel::getSYID())
				->where('semid', FinanceModel::getSemID())
				->where('classid', '!=', null)
				->where('pschemeid', '!=', null)
				->where('deleted', 0)
				->get();

			// $classification = FinanceModel::loadClassification($studid);

			$list = '';
			foreach($studledger as $class)
			{
				$list .= '
					<option value="'.$class->classid.'" mop-id="'.$class->pschemeid.'">'.$class->particulars.'</option>
				';
			}

			$data = array(
				'lists' => $list
			);

			echo json_encode($data);
		}
	}

	public function saveStudDiscount(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$discountid = $request->get('discountid');
			$classid = $request->get('classid');
			$pschemeid = $request->get('pschemeid');

			$syid = FinanceModel::getSYID();
			$semid = FinanceModel::getsemID();

			$studdiscount = db::table('studdiscounts')
					->where('studid', $studid)
					->where('discountid', $discountid)
					->where('deleted', 0)
					->get();

			if(count($studdiscount) == 0)
			{
				$ins = db::table('studdiscounts')
					->insert([
						'studid' => $studid,
						'discountid' => $discountid,
						'syid' => $syid,
						'semid' => $semid,
						'classid' => $classid,
						'paysetupid' => $pschemeid,
						'posted' => 0,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);	
				return 1;
			}
			else
			{
				return 0;
			}
			
		}
	}

	public function searchStudDiscount(Request $request)
	{
		if($request->ajax())
		{
			$lists = db::table('studdiscounts')
					->select('studdiscounts.id', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'particulars', 'percent', 'amount', 'posted')
					->join('studinfo', 'studdiscounts.studid', '=', 'studinfo.id')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('discounts', 'studdiscounts.discountid', '=', 'discounts.id')
					->where('studdiscounts.deleted', 0)
					->orderBy('posted', 'asc')
					->orderBy('id', 'DESC')
					->get();

			$disc = '';
			$studname ='';
			$percent = '';
			$amount = '';
			$unposted=0;
			foreach($lists as $list)
			{
				$studname = $list->lastname . ', ' . $list->firstname . ' ' . $list->middlename . ' ' . $list->suffix;
				if($list->posted == 0)
				{
					$unposted += 1;
				}
				if($list->percent == 1)
				{
					$amount = $list->amount . ' %';
				}
				else
				{

					$amount = number_format((float)$list->amount, 2);
				}

				if($list->posted == 1)
				{
					$disc .='
						<tr>
						<td>'.$studname.'</td>
						<td>'.$list->levelname.'</td>
						<td>'.$list->particulars.'</td>
						<td class="text-center">'.$amount.'</td>
						<td><button class="btn btn-success btn-sm btn-posted" data-id="'.$list->id.'" disabled><i class="fas fa-check"></i></button></td>
						<td><button class="btn btn-danger btn-sm" disabled><i class="fas fa-trash"></i></button></td>
						</tr>
					';
				}
				else
				{
					$disc .='
						<tr>
						<td>'.$studname.'</td>
						<td>'.$list->levelname.'</td>
						<td>'.$list->particulars.'</td>
						<td class="text-center">'.$amount.'</td>
						<td><button class="btn btn-primary btn-sm btn-posted" data-id="'.$list->id.'""><i class="fas fa-check"></i></button></td>
						<td><button class="btn btn-danger btn-sm btn-del" data-id="'.$list->id.'"><i class="fas fa-trash"></i></button></td>
						</tr>
					';
				}
			}
			if($unposted > 0)
			{
				$retUnpost = 'Unposted: ' . $unposted;
			}
			else
			{
				$retUnpost = '';
			}
			$data = array(
				'lists' => $disc,
				'unposted' => $retUnpost
			);

			echo json_encode($data);
		}
	}

	public function postStudDiscount(Request $request)
	{
		if($request->ajax())
		{
			$discountid = $request->get('discountid');
			$tAmount = 0;



			$discountinfo = db::table('studdiscounts')
					->select('studdiscounts.*', 'particulars', 'amount', 'percent')
					->join('discounts', 'studdiscounts.discountid', '=', 'discounts.id')
					->where('studdiscounts.id', $discountid)
					->first();

			$studid = $discountinfo->studid;

			$studinfo = db::table('studinfo')
					->where('id', $studid)
					->first();

			$syid = $discountinfo->syid;
			$semid = $discountinfo->semid;

			// return $syid

			$request->request->add(['feesid' => $studinfo->feesid]);
			$request->request->add(['studid' => $studinfo->id]);
			$request->request->add(['syid' => $syid]);
			$request->request->add(['semid' => $semid]);

			$esc = $studinfo->grantee;				

			$studledger = db::table('studledger')
				->where('deleted', 0)
				->where('studid', $studid)
				->where('classid', $discountinfo->classid)
				->where('syid', $syid)
				->where('semid', $semid)
				->first();

			if($studinfo->levelid == 14 || $studinfo->levelid == 15)
			{
				$enroll = db::table('sh_enrolledstud')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('semid', $semid)
					->get();
			}
			elseif($studinfo->levelid >=17 && $studinfo->levelid <= 22)
			{
				$enroll = db::table('college_enrolledstud')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('semid', $semid)
					->get();	
			}
			else
			{
				$enroll = db::table('enrolledstud')
					->where('studid', $studid)
					->where('syid', $syid)
					->get();
			}

			if(count($enroll) > 0)
			{
				if($discountinfo->percent == 1)
				{
					$tAmount = ($discountinfo->amount / 100) * $studledger->amount;
					$tAmount = number_format($tAmount, 2, '.', '');
				}
				else
				{
					$tAmount = $discountinfo->amount;
				}

				$payschedDetail = db::table('studpayscheddetail')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('semid', $semid)
					->where('balance', '>', 0)
					->where('deleted', 0)
					->where('classid', $discountinfo->classid)
					->get();

				$_over = 0;

				$totalpay = 0;
				if(count($payschedDetail) > 0)
				{
					// $calcAmount = $tAmount / count($payschedDetail);
					$_over = $tAmount;

					foreach($payschedDetail as $paysched)
					{
						$payInfo = db::table('studpayscheddetail')
							->where('id', $paysched->id)
							->first();

						$_bal = $paysched->balance;

						if($_bal <= $_over)
						{

							$totalpay = $payInfo->amount;

							$_over -= $payInfo->amount - $payInfo->amountpay;

							$updpaySched = db::table('studpayscheddetail')
									->where('id', $paysched->id)
									->update([
										'amountpay' => $totalpay,
										'balance' => 0,
										'updateddatetime' => FinanceModel::getServerDateTime(),
                    					'updatedby' => auth()->user()->id
									]);
							

						}
						else
						{
							if($_over > 0)
							{
								$totalpay = $payInfo->amountpay + $_over;

								$updpaySched = db::table('studpayscheddetail')
										->where('id', $paysched->id)
										->update([
											'amountpay' => $totalpay,
											'balance' => $payInfo->amount - $totalpay,
											'updateddatetime' => FinanceModel::getServerDateTime(),
                    						'updatedby' => auth()->user()->id
										]);

								$_over = 0;
							}
						}
						
					}
				}

				if($_over > 0)
				{
					$payschedDetail = db::table('studpayscheddetail')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('semid', $semid)
						->where('balance', '>', 0)
						->where('deleted', 0)
						// ->where('classid', $discountinfo->classid)
						->get();

					if(count($payschedDetail) > 0)
					{
						foreach($payschedDetail as $paysched)
						{
							$payInfo = db::table('studpayscheddetail')
								->where('id', $paysched->id)
								->first();

							$_bal = $paysched->balance;

							if($_bal <= $_over)
							{

								$totalpay = $payInfo->amount;

								$_over -= $payInfo->amount - $payInfo->amountpay;

								$updpaySched = db::table('studpayscheddetail')
										->where('id', $paysched->id)
										->update([
											'amountpay' => $totalpay,
											'balance' => 0,
											'updateddatetime' => FinanceModel::getServerDateTime(),
	                    					'updatedby' => auth()->user()->id
										]);
								

							}
							else
							{
								if($_over > 0)
								{
									$totalpay = $payInfo->amountpay + $_over;

									$updpaySched = db::table('studpayscheddetail')
											->where('id', $paysched->id)
											->update([
												'amountpay' => $totalpay,
												'balance' => $payInfo->amount - $totalpay,
												'updateddatetime' => FinanceModel::getServerDateTime(),
	                    						'updatedby' => auth()->user()->id
											]);

									$_over = 0;
								}
							}
							
						}
					}
				}
				
				
				
				

				$insLedger = db::table('studledger')
						->insert([
							'studid' => $studid,
							'enrollid' => $enroll[0]->id,
							'syid' => $syid,
							'semid' => $semid,
							'particulars' =>'DISCOUNT: ' . $discountinfo->particulars,
							'payment' => $tAmount,
							'ornum' => $discountid,
							'deleted' => 0,
							'createdby' => auth()->user()->id,
							'createddatetime' => FinanceModel::getServerDateTime()
						]);

				$updstudDiscount = db::table('studdiscounts')
						->where('id', $discountid)
						->update([
							'posted' => 1
						]);

				// FinanceUtilityModel::resetv3_generatediscounts($studid, $studinfo->levelid, $syid, $semid);
				UtilityController::resetpayment_v3($request);

				return 1;

			}
			else
			{
				return 0;
			}

		}
	}
	
	public function loaddiscount(Request $request)
	{
		if($request->ajax())
		{
			$discount = FinanceModel::loadDiscountTemplate();

			$list ='<option value="0"></option>';

			foreach($discount as $disc)
			{
				$list .='
					<option value="'.$disc->id.'" data-value="'.$disc->amount.'" data-kind="'.$disc->percent.'">'.$disc->particulars.'</option>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function delstuddiscount(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$del = db::table('studdiscounts')
					->where('id', $dataid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

			return 1;

		}
	}

	public function duplicateFC(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');

			$tuition = db::table('tuitionheader')
					->where('id', $headerid)
					->first();

			$dupid = db::table('tuitionheader')
					->insertGetId([
						'description' => $tuition->description . ' (DUPLICATE)',
						'syid' => $tuition->syid,
						'semid' => $tuition->semid,
						'levelid' => $tuition->levelid,
						'grantee' => $tuition->grantee,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

			$tdetails = db::table('tuitiondetail')
					->where('headerid', $headerid)
					->where('deleted', 0)
					->get();

			foreach($tdetails as $detail)
			{
				$dupdetailid = db::table('tuitiondetail')
						->insertGetId([
							'headerid' => $dupid,
							'classificationid' => $detail->classificationid,
							'amount' => $detail->amount,
							'isdp' => $detail->isdp,
							'pschemeid' => $detail->pschemeid,
							'deleted' => 0,
							'createdby' => auth()->user()->id,
							'createddatetime' => FinanceModel::getServerDateTime()
						]);

				$items = db::table('tuitionitems')
						->where('tuitiondetailid', $detail->id)
						->where('deleted', 0)
						->get();

				foreach($items as $item)
				{
					$dupitem = db::table('tuitionitems')
							->insert([
								'tuitiondetailid' => $dupdetailid,
								'itemid' => $item->itemid,
								'amount' => $item->amount,
								'deleted' => 0,
								'createdby' => auth()->user()->id,
								'createddatetime' => auth()->user()->id
							]);
				}

			}

			return $dupid;
		}
	}

	public function tuitionentry()
	{
		return view('finance.tuitionentry');
	}

	public function loadTsetup(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = 0;

			$lists = '';
			
			if($levelid == 14 || $levelid == 15)
			{
				$semid = $request->get('semid');

				$tuitionheader = db::table('tuitionheader')
						->select('tuitionheader.*', 'gradelevel.levelname', 'grantee.description', 'strandcode')
						->join('gradelevel', 'tuitionheader.levelid', '=', 'gradelevel.id')
						->join('grantee', 'tuitionheader.grantee', '=', 'grantee.id')
						->join('sh_strand', 'tuitionheader.strandid', '=', 'sh_strand.id')
						->where('levelid', $levelid)
						->where('syid', $syid)
						->where('semid', $semid)
						->where('tuitionheader.deleted', 0)
						->get();	

				foreach($tuitionheader as $tui)
				{
					$lists .='
						<div class="col-md-3">
	            			<div class="card tui-card" data-id="'.$tui->id.'" style="cursor: pointer;">
	              				<div class="card-header">
	                				<h5 class="card-title">'.$tui->description.'</h5>
	              				</div>
	              				<div class="card-body">
	                				<div>GRADE LEVEL: <span class="text-bold">'.strtoupper($tui->levelname).'</span></div>
	                				<div>ESC: <span class="text-bold">'.$tui->description.'</span></div>
	                				<div>Track: <span class="text-bold">'.$tui->strandcode.'</span></div>
	              				</div>
	            			</div>
	          			</div>
					';
				}


			}
			elseif($levelid >= 17 && $levelid <= 21)
			{
				$tuitionheader = db::table('tuitionheader')
					->select('tuitionheader.*', 'gradelevel.levelname', 'courseabrv')
					->join('gradelevel', 'tuitionheader.levelid', '=', 'gradelevel.id')
					->leftjoin('college_courses', 'tuitionheader.courseid', '=', 'college_courses.id')
					->where('levelid', $levelid)
					->where('syid', $syid)
					->where('tuitionheader.deleted', 0)
					->get();					

				foreach($tuitionheader as $tui)
				{
					$lists .='
						<div class="col-md-4">
	            			<div class="card tui-card" data-id="'.$tui->id.'" style="cursor: pointer;">
	              				<div class="card-header">
	                				<h5 class="card-title">'.$tui->courseabrv.'</h5>
	              				</div>
	              				<div class="card-body">
	                				<div>GRADE LEVEL: <span class="text-bold">'.$tui->levelname.'</span></div>
	              				</div>
	            			</div>
	          			</div>
					';
				}

			}
			else
			{
				$tuitionheader = db::table('tuitionheader')
					->select('tuitionheader.*', 'gradelevel.levelname', 'grantee.description')
					->join('gradelevel', 'tuitionheader.levelid', '=', 'gradelevel.id')
					->join('grantee', 'tuitionheader.grantee', '=', 'grantee.id')
					->where('levelid', $levelid)
					->where('syid', $syid)
					->where('tuitionheader.deleted', 0)
					->get();				

				foreach($tuitionheader as $tui)
				{
					$lists .='
						<div class="col-md-3">
	            			<div class="card tui-card" data-id="'.$tui->id.'" style="cursor: pointer;">
	              				<div class="card-header">
	                				<h5 class="card-title">'.$tui->description.'</h5>
	              				</div>
	              				<div class="card-body">
	                				<div>GRADE LEVEL: <span class="text-bold">'.strtoupper($tui->levelname).'</span></div>
	                				<div>ESC: <span class="text-bold">'.$tui->description.'</span></div>
	              				</div>
	            			</div>
	          			</div>
					';
				}
			}

			

				

			$data = array(
				'lists' => $lists
			);

			echo json_encode($data);
		}
	}

	public function loadTstudent(Request $request)
	{
		if($request->ajax())
		{
			$tuitionid = $request->get('tuitionid');

			$tuiInfo = db::table('tuitionheader')
					->where('id', $tuitionid)
					->first();


			if($tuiInfo->levelid == 14 || $tuiInfo->levelid == 15)
			{
				$enrollList = db::table('sh_enrolledstud')
					->select('sh_enrolledstud.1id as enrolledstudid', 'studinfo.id as studid', 'lastname', 'firstname', 'middlename', 'suffix', 'sectionname', 'grantee.description', 'studinfo.studstatus')
					->join('studinfo', 'sh_enrolledstud.studid', '=', 'studinfo.id')
					->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
					->where('sh_enrolledstud.syid', $tuiInfo->syid)
					->where('studinfo.levelid', $tuiInfo->levelid)
					->where('sh_enrolledstud.semid', $tuiInfo->semid)
					->where('sh_enrolledstud.deleted', 0)
					->where('grantee', $tuiInfo->grantee)
					->orderBy('sectionname', 'ASC')
					->orderBy('lastname', 'ASC')
					->orderBy('firstname', 'ASC')
					->get();
			}
			elseif($tuiInfo->levelid >= 17 && $tuiInfo->levelid <= 21)
			{
				$enrollList = db::table('college_enrolledstud')
					->select('college_enrolledstud.id as enrolledstudid', 'studinfo.id as studid', 'lastname', 'firstname', 'middlename', 'suffix', 'sectionname', 'studinfo.studstatus', 'courseabrv as description', 'college_enrolledstud.courseid')
					->join('studinfo', 'college_enrolledstud.studid', '=', 'studinfo.id')
					->join('college_courses', 'college_enrolledstud.courseid', '=', 'college_courses.id')
					->where('college_enrolledstud.syid', $tuiInfo->syid)
					->where('studinfo.levelid', $tuiInfo->levelid)
					->where('college_enrolledstud.semid', $tuiInfo->semid)
					->where('college_enrolledstud.deleted', 0)
					->where('college_enrolledstud.courseid', $tuiInfo->courseid)
					->orderBy('sectionname', 'ASC')
					->orderBy('lastname', 'ASC')
					->orderBy('firstname', 'ASC')
					->get();
				
				if(count($enrollList) == 0)
				{
					$enrollList = db::table('college_enrolledstud')
						->select('college_enrolledstud.id as enrolledstudid', 'studinfo.id as studid', 'lastname', 'firstname', 'middlename', 'suffix', 'sectionname', 'studinfo.studstatus', 'courseabrv as description', 'college_enrolledstud.courseid')
						->join('studinfo', 'college_enrolledstud.studid', '=', 'studinfo.id')
						->join('college_courses', 'college_enrolledstud.courseid', '=', 'college_courses.id')
						->where('college_enrolledstud.syid', $tuiInfo->syid)
						->where('studinfo.levelid', $tuiInfo->levelid)
						->where('college_enrolledstud.semid', $tuiInfo->semid)
						->where('college_enrolledstud.deleted', 0)
						->orderBy('sectionname', 'ASC')
						->orderBy('lastname', 'ASC')
						->orderBy('firstname', 'ASC')
						->get();	
				}

				
			}
			else
			{
				$enrollList = db::table('enrolledstud')
							->select('enrolledstud.id as enrolledstudid', 'studinfo.id as studid', 'lastname', 'firstname', 'middlename', 'suffix', 'sectionname', 'grantee.description', 'studinfo.studstatus')
							->join('studinfo', 'enrolledstud.studid', '=', 'studinfo.id')
							->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
							->where('syid', $tuiInfo->syid)
							->where('studinfo.levelid', $tuiInfo->levelid)
							->where('enrolledstud.deleted', 0)
							->where('grantee', $tuiInfo->grantee)
							->orderBy('sectionname', 'ASC')
							->orderBy('lastname', 'ASC')
							->orderBy('firstname', 'ASC')
							->get();	
			}
			

			$studlists = '';
			$tui = 0;

			$studstatus = '';
			foreach($enrollList as $enroll)
			{
				$studname = $enroll->lastname . ', ' . $enroll->firstname . ' ' . $enroll->middlename . ' ' .$enroll->suffix;

				if($enroll->studstatus == 1)
  				{
  					$status = 'bg-success';
  				}
  				elseif($enroll->studstatus == 2)
  				{
  					$status = 'bg-primary';
  				}
  				elseif($enroll->studstatus == 3)
  				{
  					$status = 'bg-danger';
  				}
  				elseif($enroll->studstatus == 4)
  				{
  					$status = 'bg-warning';	
  				}
  				elseif($enroll->studstatus == 5)
  				{
  					$status = 'bg-secondary';	
  				}
  				else
	  			{
	  				$status = '';		
	  			}

  				$CheckLedger = 0;

	  			if($tuiInfo->levelid == 14 || $tuiInfo->levelid == 15)
	  			{
	  				$tuiDetail = db::table('tuitiondetail')
	  						->join('tuitionheader', 'tuitiondetail.headerid', '=', 'tuitionheader.id')
	  						->where('headerid', $tuiInfo->id)
	  						->where('syid', $tuiInfo->syid)
	  						->where('semid', $tuiInfo->semid)
	  						->where('tuitiondetail.deleted', 0)
	  						->get();

					foreach($tuiDetail as $detail)
					{
						$studledger = db::table('studledger')
		  					->where('studid', $enroll->studid)
		  					->where('syid', $tuiInfo->syid)
		  					->where('semid', $tuiInfo->semid)
		  					->where('classid', $detail->classificationid)
		  					->where('deleted', 0)
		  					->get();

		  				if(count($studledger) == 0)
		  				{
		  					$CheckLedger += 1;
		  				}
					}
	  			}

	  			elseif($tuiInfo->levelid >= 17 || $tuiInfo->levelid <= 21)
	  			{
					$tuiDetail = db::table('tuitiondetail')
						->join('tuitionheader', 'tuitiondetail.headerid', '=', 'tuitionheader.id')
						->where('headerid', $tuiInfo->id)
						->where('syid', $tuiInfo->syid)
						->where('semid', $tuiInfo->semid)
						->where('courseid', $tuiInfo->courseid)
						->where('tuitiondetail.deleted', 0)
						->get();

					if(count($tuiDetail) == 0)
					{
						$tuiDetail = db::table('tuitiondetail')
							->join('tuitionheader', 'tuitiondetail.headerid', '=', 'tuitionheader.id')
							->where('headerid', $tuiInfo->id)
							->where('syid', $tuiInfo->syid)
							->where('semid', $tuiInfo->semid)
							->where('tuitiondetail.deleted', 0)
							->get();					
					}

					foreach($tuiDetail as $detail)
					{
						// $studledger = db::table('studledger')
		  		// 			->where('studid', $enroll->studid)
		  		// 			->where('syid', $tuiInfo->syid)
		  		// 			->where('semid', $tuiInfo->semid)
		  		// 			->where('classid', $detail->classificationid)
		  		// 			->where('deleted', 0)
		  		// 			->get();
						$studledger = db::table('studledger')
							->where('studid', $enroll->studid)
							->where('syid', $tuiInfo->syid)
							->where('semid', $tuiInfo->semid)
							->where('deleted', 0)
							->sum('amount');
						
						// return $studledger;

		  				if($studledger == 0)
		  				{
		  					$CheckLedger += 1;
		  				}
					}
	  			}
	  			else
	  			{
	  				$tuiDetail = db::table('tuitiondetail')
						->join('tuitionheader', 'tuitiondetail.headerid', '=', 'tuitionheader.id')
						->where('headerid', $tuiInfo->id)
						->where('syid', $tuiInfo->syid)
						->where('tuitiondetail.deleted', 0)
						->get();

	  				foreach($tuiDetail as $detail)
					{
						$studledger = db::table('studledger')
	  					->where('studid', $enroll->studid)
	  					->where('syid', $tuiInfo->syid)
	  					->where('classid', $detail->classificationid)
	  					->where('deleted', 0)
	  					->get();

		  				if(count($studledger) == 0)
		  				{
		  					$CheckLedger += 1;
		  				}
					}		
	  			}

  				$tSetup = '';
  				$studarray = array();

	 			if($CheckLedger != 0)
	  			{
	  				// $tSetup = '<i class="fas fa-check"></i>';

	  				$studlists .='
						<tr data-id="'.$enroll->studid.'">
							<td class="'.$status.', p-0" style="padding:0px"></td>
							<td>'.$studname.'</td>
							<td>'.$enroll->sectionname.'</td>
							<td class="">'.$enroll->description.'</td>
						</tr>
					';
	  			}
	  			else
	  			{
	  				$tSetup = '';
	  			}

				// $studlists .='
				// 	<tr>
				// 		<td class="'.$status.', p-0" style="padding:0px"></td>
				// 		<td>'.$studname.'</td>
				// 		<td>'.$enroll->sectionname.'</td>
				// 		<td class="text-center">'.$enroll->description.'</td>
				// 		<td class="text-center">'.$tSetup.'</td>
				// 	</tr>
				// ';
			}

			$tDetails = db::table('tuitiondetail')
					->select('itemclassification.description', 'tuitiondetail.amount')
					->join('itemclassification', 'tuitiondetail.classificationid', 'itemclassification.id')
					->where('headerid', $tuitionid)
					->where('tuitiondetail.deleted', 0)
					->get();

			$detailList ='';
			$totalDetail = 0;
			foreach($tDetails as $tDetail)
			{
				$totalDetail += $tDetail->amount;
				$detailList .='
					<tr>
	          			<td>'.$tDetail->description.'</td>
	          			<td>'.number_format($tDetail->amount, 2).'</td>
	        		</tr>
				';
			}

			$detailList .='
				<tr class="bg-primary">
					<td class="text-right text-bold">TOTAL: </td>
					<td class="text-right text-bold">'.number_format($totalDetail, 2).'</td>
				</tr>
				<tr id="tui-entry" data-id="'.$tuitionid.'" class="bg-info" style="cursor:pointer">
					<td colspan="2" class="text-center text-bold">PROCEED</td>
				</tr>
			';

			$data = array(
				'studlist' => $studlists,
				'tparticulars' => $detailList
			);

			echo json_encode($data);

		}
	}

	public function procTuition(Request $request)
	{
		if($request->ajax())
		{
			$tuitionid = $request->get('tuitionid');
			$studarray = $request->get('studarray');

			$tuiInfo = db::table('tuitionheader')
					->where('id', $tuitionid)
					->first();

			$escVal = '';

			if($tuiInfo->levelid == 14 || $tuiInfo->levelid == 15)
			{
				
				$enrollList = db::table('sh_enrolledstud')
					->select('sh_enrolledstud.*', 'grantee.description', 'studinfo.levelid')
					->join('studinfo', 'sh_enrolledstud.studid', '=', 'studinfo.id')
					->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
					->where('sh_enrolledstud.syid', $tuiInfo->syid)
					->where('sh_enrolledstud.semid', $tuiInfo->semid)
					->where('studinfo.levelid', $tuiInfo->levelid)
					->where('grantee', $tuiInfo->grantee)
					->where('sh_enrolledstud.deleted', 0)
					->get();

				foreach($enrollList as $enroll)
				{
					$tDetails = db::table('tuitiondetail')
						->select('tuitiondetail.id', 'headerid', 'classificationid', 'amount', 'itemclassification.description', 'pschemeid')
						->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
						->where('headerid', $tuitionid)
						->where('tuitiondetail.deleted', 0)
						->get();

					foreach($tDetails as $detail)
					{
						$ledger = db::table('studledger')		
							->where('studid', $enroll->studid)
							->where('syid', $enroll->syid)
							->where('semid', $enroll->semid)
							->where('classid', $detail->classificationid)
							->get();

						if(count($ledger) == 0)
						{
							
							$ledgerAppend = db::table('studledger')
									->insert([
										'studid' => $enroll->studid,
										'enrollid' => $enroll->id,
										'syid' => $enroll->syid,
										'semid' => $enroll->semid,
										'classid' => $detail->classificationid,
										'particulars'=> $detail->description,
										'amount' => $detail->amount,
										'pschemeid' => $detail->pschemeid,
										'deleted' => 0,
										'createdby' => auth()->user()->id,
										'createddatetime' => FinanceModel::getServerDateTime()
									]);

							$paymentsetup = db::table('paymentsetup')
			  					->select('paymentsetup.id', 'paymentdesc', 'paymentsetup.noofpayment', 'paymentno', 'duedate')
			  					->leftjoin('paymentsetupdetail', 'paymentsetup.id', '=', 'paymentsetupdetail.paymentid')
			  					->where('paymentsetup.id', $detail->pschemeid)
			  					->get();

		  					$divPay = 0;

				  			if(count($paymentsetup) > 1)
				  			{
				  				$paymentno = $paymentsetup[0]->noofpayment;
				  				$divPay = $detail->amount / $paymentno;
				  			}
				  			else
				  			{
				  				$divPay = $detail->amount;
				  			}

				  			foreach($paymentsetup as $pay)
				  			{
				  				$scheditem = db::table('studpayscheddetail')
				  						->insert([
				  							'studid' => $enroll->studid,
				  							'enrollid' => $enroll->id,
				  							'syid' => $enroll->syid,
				  							'semid' => $enroll->semid,
				  							'tuitiondetailid' => $detail->id,
				  							'particulars' => $detail->description,
				  							'duedate' => $pay->duedate,
				  							'paymentno' => $pay->paymentno,
				  							'amount' => $divPay,
				  							'classid' => $detail->classificationid
				  						]);
				  			}

			  				$schedgroup = db::select('SELECT duedate, paymentno, particulars, classid, SUM(amount) AS amount FROM studpayscheddetail where studid = ? and syid = ? and semid = ? group by month(duedate), duedate, paymentno order by duedate', [$enroll->studid, $enroll->syid, $enroll->semid]);

				  			foreach($schedgroup as $sched)
				  			{
				  				if(empty($sched->duedate))
				  				{
				  					$paysched = db::table('studpaysched')
				  						->insert([
				  							'enrollid' => $enroll->id,
				  							'studid' => $enroll->studid,
				  							'syid' =>$enroll->syid,
				  							'semid' => $enroll->semid,
				  							'classid' => $sched->classid,
				  							'paymentno' => $sched->paymentno,
				  							'particulars' => $sched->particulars,
				  							'duedate' => $sched->duedate,
				  							'amountdue' => $sched->amount,
				  							'balance' => $sched->amount
				  						]);		
				  				}
				  				else
				  				{
				  					$paysched = db::table('studpaysched')
				  						->insert([
				  							'enrollid' => $enroll->id,
				  							'studid' => $enroll->studid,
				  							'syid' =>$enroll->syid,
				  							'semid' => $enroll->semid,
				  							'classid' => $sched->classid,
				  							'paymentno' => $sched->paymentno,
				  							'particulars' => 'TUITION/BOOK FEE - '. strtoupper(date('F', strtotime($sched->duedate))),
				  							'duedate' => $sched->duedate,
				  							'amountdue' => $sched->amount,
				  							'balance' => $sched->amount
				  						]);	
				  				}
				  				
				  			}
			  			

						}
					}
				}

			}
			if($tuiInfo->levelid >= 17 && $tuiInfo->levelid <= 21)
			{
				foreach($studarray as $stud)
				{
					$studinfo = db::table('studinfo')
						->select('studinfo.*', 'college_enrolledstud.id as enrolledstudid')
						->join('college_enrolledstud', 'studinfo.id', '=', 'college_enrolledstud.studid')
						->where('studinfo.id', $stud)
						->first();


					$studid = $studinfo->id;
					$glevel = $studinfo->levelid;
					$sy = FinanceModel::getSYID();
					$semid = FinanceModel::getsemID();
					$enrolledstudid = $studinfo->enrolledstudid;

					$tuition = db::table('tuitionheader')
			  			->select('tuitionheader.id', 'tuitiondetail.id as tuitiondetailid', 'syid', 'levelid', 'itemclassification.description as particulars', 'amount', 'itemclassification.id as classid', 'pschemeid', 'semid', 'istuition')
			  			->leftjoin('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')	
			  			->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
			  			->where('levelid', $studinfo->levelid)
			  			->where('courseid', $studinfo->courseid)
			  			->where('syid', FinanceModel::getSYID())
			  			->where('semid', FinanceModel::getsemID())
			  			->where('tuitionheader.deleted', 0)
			  			->where('tuitiondetail.deleted', 0)
			  			->get();

			  		if(count($tuition) == 0)
			  		{
			  			$tuition = db::table('tuitionheader')
				  			->select('tuitionheader.id', 'tuitiondetail.id as tuitiondetailid', 'syid', 'levelid', 'itemclassification.description as particulars', 'amount', 'itemclassification.id as classid', 'pschemeid', 'semid', 'istuition')
				  			->leftjoin('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')	
				  			->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
				  			->where('levelid', $studinfo->levelid)
				  			->where('syid', FinanceModel::getSYID())
			  				->where('semid', FinanceModel::getsemID())
				  			->where('tuitionheader.deleted', 0)
				  			->where('tuitiondetail.deleted', 0)
				  			->get();		
			  		}

			  		$totalunits = db::select('
		  				SELECT SUM(lecunits) + SUM(labunits) AS totalunits
						FROM college_studsched
						INNER JOIN college_classsched ON college_studsched.`schedid` = college_classsched.`id`
						INNER JOIN college_prospectus ON college_classsched.`subjectID` = college_prospectus.`id`
						WHERE college_studsched.`studid` = ? and college_studsched.`deleted` = 0	
		  			', [$studinfo->id]);

			  		$units = $totalunits[0]->totalunits;


			  		foreach($tuition as $tui)
			  		{
			  			if($glevel >= 17 && $glevel <=21)
			  			{
			  				if($tui->istuition == 1)
			  				{
			  					echo $tui->amount . ' * ' . $units;
			  					$tuitionamount = $tui->amount * $units;
			  				}
			  				else
			  				{
			  					$tuitionamount = $tui->amount;
			  				}
			  			}
			  			else
			  			{
			  				$tuitionamount = $tui->amount;
			  			}


			  			$sLedger = db::table('studledger')
		  					->insert([
		  						'studid' => $studid,
		  						'enrollid' => $enrolledstudid,
		  						'syid' => $sy,
		  						'semid' => $semid,
		  						'classid' => $tui->classid,
		  						'particulars' => $tui->particulars,
		  						'amount' => $tuitionamount,
		  						'pschemeid' => $tui->pschemeid,
		  						'deleted' => 0,
		  						'createddatetime' => FinanceModel::getServerDateTime()
		  					]);

			  			$paymentsetup = db::table('paymentsetup')
		  					->select('paymentsetup.id', 'paymentdesc', 'paymentsetup.noofpayment', 'paymentno', 'duedate')
		  					->leftjoin('paymentsetupdetail', 'paymentsetup.id', '=', 'paymentsetupdetail.paymentid')
		  					->where('paymentsetup.id', $tui->pschemeid)
		  					->where('paymentsetupdetail.deleted', 0)
		  					->get();
			  			// echo ' ' . $paymentsetup . '; ';
			  			$divPay = 0;

			  			if(count($paymentsetup) > 1)
			  			{
			  				$paymentno = $paymentsetup[0]->noofpayment;
			  				$divPay = $tuitionamount / $paymentno;
			  				$divPay = number_format($divPay, 2, '.', '');
			  			}
			  			else
			  			{
			  				$paymentno = 1;
			  				$divPay = $tuitionamount;
			  				$divPay = number_format($divPay, 2, '.', '');
			  			}

			  			// echo ' divPay: ' . $divPay;
			  			$paycount = 0;
			  			$paytAmount = 0;
			  			$paydisbalance = 0;

			  			

			  			foreach($paymentsetup as $pay)
			  			{
			  				$paycount += 1;
			  				$paytAmount += $divPay;

			  				if($paycount != $paymentno)
			  				{
			  					$scheditem = db::table('studpayscheddetail')
			  						->insert([
			  							'studid' => $studid,
			  							'enrollid' => $enrolledstudid,
			  							'syid' => $sy,
			  							'semid' => $semid,
			  							'tuitiondetailid' => $tui->tuitiondetailid,
			  							'particulars' => $tui->particulars,
			  							'duedate' => $pay->duedate,
			  							'paymentno' => $pay->paymentno,
			  							'amount' => $divPay,
			  							'balance' => $divPay,
			  							'classid' => $tui->classid
			  						]);
			  				}
			  				else
			  				{
			  					// echo ' payAmount: '. $paytAmount . ' <= ' . $tuitionamount . '; ';
			  					if($paytAmount <= $tuitionamount)
			  					{
			  						$paydisbalance = $tuitionamount - $paytAmount;
			  						$paydisbalance = number_format($paydisbalance, 2, '.', '');

			  						$divPay += $paydisbalance;
			  						
			  						// echo ' paydisbalance: ' . $paydisbalance;
			  						// echo ' +divPay: '. $divPay;
			  						$scheditem = db::table('studpayscheddetail')
				  						->insert([
				  							'studid' => $studid,
				  							'enrollid' => $enrolledstudid,
				  							'syid' => $sy,
				  							'semid' => $semid,
				  							'tuitiondetailid' => $tui->tuitiondetailid,
				  							'particulars' => $tui->particulars,
				  							'duedate' => $pay->duedate,
				  							'paymentno' => $pay->paymentno,
				  							'amount' => $divPay,
				  							'balance' => $divPay,
				  							'classid' => $tui->classid
				  						]);

			  					}
			  					else
			  					{
			  						$paydisbalance = $paytAmount - $tuitionamount;
			  						$paydisbalance = number_format($paydisbalance, 2, '.', '');


			  						// $divPay = number_format($divPay - $paydisbalance);
			  						$divPay -= $paydisbalance;
			  						// echo ' paydisbalance: ' . $paydisbalance;
			  						// echo ' -divPay: '. $divPay;

			  						$scheditem = db::table('studpayscheddetail')
			  						->insert([
			  							'studid' => $studid,
			  							'enrollid' => $enrolledstudid,
			  							'syid' => $sy,
			  							'semid' => $semid,
			  							'tuitiondetailid' => $tui->tuitiondetailid,
			  							'particulars' => $tui->particulars,
			  							'duedate' => $pay->duedate,
			  							'paymentno' => $pay->paymentno,
			  							'amount' => $divPay,
			  							'balance' => $divPay,
			  							'classid' => $tui->classid
			  						]);
			  					}
			  				}
			  			}
			  		}

			  		$tDP = 0;
			  		$dpBal = 0;
			  		$schdbal = 0;
			  		$aPay = 0;
			  		$_over=0;

			  		$getdp = db::table('chrngtransdetail')				
						->select('studid', 'syid', 'semid', 'itemkind', 'payschedid', 'isdp', 'chrngtransdetail.classid', 'chrngtransdetail.amount')
						->join('chrngtrans', 'chrngtransdetail.chrngtransid', '=', 'chrngtrans.id')
						->join('items', 'chrngtransdetail.payschedid', '=', 'items.id')
						->where('studid', $studid)
						->where('syid', FinanceModel::getSYID())
						->where('semid', FinanceModel::getSemID())
						->where('itemkind', 1)
						->where('isdp', 1)
						->where('chrngtrans.cancelled', 0)
						->get();
					if(count($getdp) > 0)
					{
						foreach($getdp as $dp)
						{
							$dpBal = $dp->amount;

							// echo '(' . $dpBal . ')';

							$balforward = db::table('balforwardsetup')
								->first();


							$getpaySched = db::table('studpayscheddetail')
									->where('studid', $studid)
									->where('syid', FinanceModel::getSYID())
									->where('semid', FinanceModel::getSemID())
									->where('classid', $balforward->classid)
									->get();							

							if(count($getpaySched) > 0)
							{
								foreach($getpaySched as $sched)
								{
									if($dpBal > 0)
									{
										$schedbal = $sched->amount - $sched->amountpay;

										if($dpBal > $schedbal)
										{
											$deductDP = db::table('studpayscheddetail')
												->where('id', $sched->id)
												->update([
													'amountpay' => $schedbal + $sched->amountpay,
													'balance' => 0,
													'updateddatetime' => FinanceModel::getServerDateTime(),
													'updatedby' => auth()->user()->id
													]);

											$dpBal -= $schedbal;
										}
										else
										{
											$tDP = $sched->amount - $dpBal;
											$aPay = $sched->amountpay + $dpBal;

											$deductDP = db::table('studpayscheddetail')
												->where('id', $sched->id)
												->update([
													'amountpay' => $aPay,
													'balance' => $tDP,
													'updateddatetime' => FinanceModel::getServerDateTime(),
													'updatedby' => auth()->user()->id
												]);
										}
									}
								}
							}



							$getpaySched = db::table('studpayscheddetail')
								->where('studid', $studid)
								->where('syid', FinanceModel::getSYID())
								->where('semid', FinanceModel::getSemID())
								->where('classid', $dp->classid)
								->get();

							if(count($getpaySched) > 0)
							{
								foreach($getpaySched as $sched)
								{
									if($dpBal > 0)
									{
										// echo '[' . $dpBal . '>' . $sched->amount . ']';
										$schedbal = $sched->amount - $sched->amountpay;
										
										if($dpBal > $schedbal)
										{
											$tDP = 0;
											
											$deductDP = db::table('studpayscheddetail')
												->where('id', $sched->id)
												->update([
													'amountpay' => $schedbal + $sched->amountpay,
													'balance' => $tDP,
													'updateddatetime' => FinanceModel::getServerDateTime(),
													'updatedby' => auth()->user()->id
													]);

											$dpBal -= $schedbal;
										}
										else
										{
											$tDP = $sched->amount - $dpBal;
											$aPay = $sched->amountpay + $dpBal;

											// echo ' aPay = ' . $aPay;
											
											$deductDP = db::table('studpayscheddetail')
												->where('id', $sched->id)
												->update([
													'amountpay' => $aPay,
													'balance' => $tDP,
													'updateddatetime' => FinanceModel::getServerDateTime(),
													'updatedby' => auth()->user()->id
												]);
											

											$dpBal = 0;
										}
									}
								}
								if($dpBal > 0)
								{
									$gpaydetail = db::select('
										SELECT studid, syid, semid, tuitiondetailid, classid, particulars, SUM(amount) AS amount, SUM(amountpay) AS amountpay, SUM(balance) AS balance 
										FROM studpayscheddetail
										WHERE studid = ?  AND syid = ? and semid = ? AND deleted = 0 and balance > 0
										GROUP BY classid
									', [$studid, FinanceModel::getSYID(), FinanceModel::getSemID()]);

									foreach($gpaydetail as $detail)
									{
										$paysched = db::table('studpayscheddetail')
												->where('classid', $detail->classid)
												->where('studid', $studid)
												->where('syid', FinanceModel::getSYID())
												->where('semid', FinanceModel::getSemID())
												->where('deleted', 0)
												->get();

										if($dpBal > 0)
										{		
											foreach($paysched as $sched)
											{
												if($dpBal > $sched->balance)
												{
													$tDP = 0;
													$deductDP = db::table('studpayscheddetail')
														->where('id', $sched->id)
														->update([
															'amountpay' => $sched->balance + $sched->amountpay,
															'balance' => $tDP
														]);

													$dpBal -= $sched->balance;
												}
												else
												{
													$tDP = $sched->balance - $dpBal;
													$aPay = $sched->amountpay + $dpBal;
													
													$deductDP = db::table('studpayscheddetail')
														->where('id', $sched->id)
														->update([
															'amountpay' => $aPay,
															'balance' => $tDP,
															'updateddatetime' => FinanceModel::getServerDateTime(),
															'updatedby' => auth()->user()->id
														]);
													

													$dpBal = 0;
												}
											}
										}

									}

								}
							}
							else
							{
								$getpaySched = db::table('studpayscheddetail')
									->where('studid', $studid)
									->where('syid', FinanceModel::getSYID())
									->where('semid', FinanceModel::getSemID())
									// ->where('classid', $dp->classid)
									->get();

								if(count($getpaySched) > 0)
								{
									foreach($getpaySched as $sched)
									{
										if($dpBal > 0)
										{
											// echo '[' . $dpBal . '>' . $sched->amount . ']';
											$schedbal = $sched->amount - $sched->amountpay;
											
											if($dpBal > $schedbal)
											{
												$tDP = 0;
												
												$deductDP = db::table('studpayscheddetail')
													->where('id', $sched->id)
													->update([
														'amountpay' => $schedbal + $sched->amountpay,
														'balance' => $tDP,
														'updateddatetime' => FinanceModel::getServerDateTime(),
														'updatedby' => auth()->user()->id
														]);

												$dpBal -= $schedbal;
											}
											else
											{
												$tDP = $sched->amount - $dpBal;
												$aPay = $sched->amountpay + $dpBal;

												// echo ' aPay = ' . $aPay;
												
												$deductDP = db::table('studpayscheddetail')
													->where('id', $sched->id)
													->update([
														'amountpay' => $aPay,
														'balance' => $tDP,
														'updateddatetime' => FinanceModel::getServerDateTime(),
														'updatedby' => auth()->user()->id
													]);
												

												$dpBal = 0;
											}
										}
									}
									if($dpBal > 0)
									{
										$gpaydetail = db::select('
											SELECT studid, syid, semid, tuitiondetailid, classid, particulars, SUM(amount) AS amount, SUM(amountpay) AS amountpay, SUM(balance) AS balance 
											FROM studpayscheddetail
											WHERE studid = ?  AND syid = ? and semid = ? AND deleted = 0 and balance > 0
											GROUP BY classid
										', [$studid, FinanceModel::getSYID(), FinanceModel::getSemID()]);

										foreach($gpaydetail as $detail)
										{
											$paysched = db::table('studpayscheddetail')
													->where('classid', $detail->classid)
													->where('studid', $studid)
													->where('syid', FinanceModel::getSYID())
													->where('semid', FinanceModel::getSemID())
													->where('deleted', 0)
													->get();

											if($dpBal > 0)
											{		
												foreach($paysched as $sched)
												{
													if($dpBal > $sched->balance)
													{
														$tDP = 0;
														$deductDP = db::table('studpayscheddetail')
															->where('id', $sched->id)
															->update([
																'amountpay' => $sched->balance + $sched->amountpay,
																'balance' => $tDP
															]);

														$dpBal -= $sched->balance;
													}
													else
													{
														$tDP = $sched->balance - $dpBal;
														$aPay = $sched->amountpay + $dpBal;
														
														$deductDP = db::table('studpayscheddetail')
															->where('id', $sched->id)
															->update([
																'amountpay' => $aPay,
																'balance' => $tDP,
																'updateddatetime' => FinanceModel::getServerDateTime(),
																'updatedby' => auth()->user()->id
															]);
														

														$dpBal = 0;
													}
												}
											}

										}

									}
								}
							}
						}	
					}
				}
			}
			else
			{
				
					$enrollList = db::table('enrolledstud')
							->select('enrolledstud.*', 'grantee.description', 'studinfo.levelid')
							->join('studinfo', 'enrolledstud.studid', '=', 'studinfo.id')
							->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
							->where('enrolledstud.syid', $tuiInfo->syid)
							->where('studinfo.levelid', $tuiInfo->levelid)
							->where('studinfo.grantee', $tuiInfo->grantee)
							->where('enrolledstud.deleted', 0)
							->get();
					// return $enrollList;

				foreach($enrollList as $enroll)
				{
					$tDetails = db::table('tuitiondetail')
							->select('tuitiondetail.id', 'headerid', 'classificationid', 'amount', 'itemclassification.description', 'pschemeid')
							->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
							->where('headerid', $tuitionid)
							->where('tuitiondetail.deleted', 0)
							->get();


					foreach($tDetails as $detail)
					{
						$ledger = db::table('studledger')		
								->where('studid', $enroll->studid)
								->where('syid', $enroll->syid)
								->where('classid', $detail->classificationid)
								->get();

						if(count($ledger) == 0)
						{
							
							$ledgerAppend = db::table('studledger')
									->insert([
										'studid' => $enroll->studid,
										'enrollid' => $enroll->id,
										'syid' => $enroll->syid,
										'classid' => $detail->classificationid,
										'particulars'=> $detail->description,
										'amount' => $detail->amount,
										'pschemeid' => $detail->pschemeid,
										'deleted' => 0,
										'createdby' => auth()->user()->id,
										'createddatetime' => FinanceModel::getServerDateTime()
									]);

							$paymentsetup = db::table('paymentsetup')
		  					->select('paymentsetup.id', 'paymentdesc', 'paymentsetup.noofpayment', 'paymentno', 'duedate')
		  					->leftjoin('paymentsetupdetail', 'paymentsetup.id', '=', 'paymentsetupdetail.paymentid')
		  					->where('paymentsetup.id', $detail->pschemeid)
		  					->get();

		  				$divPay = 0;

			  			if(count($paymentsetup) > 1)
			  			{
			  				$paymentno = $paymentsetup[0]->noofpayment;
			  				$divPay = $detail->amount / $paymentno;
			  			}
			  			else
			  			{
			  				$divPay = $detail->amount;
			  			}

			  			foreach($paymentsetup as $pay)
			  			{
			  				$scheditem = db::table('studpayscheddetail')
			  						->insert([
			  							'studid' => $enroll->studid,
			  							'enrollid' => $enroll->id,
			  							'syid' => $enroll->syid,
			  							'tuitiondetailid' => $detail->id,
			  							'particulars' => $detail->description,
			  							'duedate' => $pay->duedate,
			  							'paymentno' => $pay->paymentno,
			  							'amount' => $divPay,
			  							'classid' => $detail->classificationid
			  						]);
			  			}

			  			$schedgroup = db::select('SELECT duedate, paymentno, particulars, classid, SUM(amount) AS amount FROM studpayscheddetail where studid = ? and syid = ? group by month(duedate), duedate, paymentno order by duedate', [$enroll->studid, $enroll->syid]);

			  			foreach($schedgroup as $sched)
			  			{
			  				if(empty($sched->duedate))
			  				{
			  					$paysched = db::table('studpaysched')
			  						->insert([
			  							'enrollid' => $enroll->id,
			  							'studid' => $enroll->studid,
			  							'syid' =>$enroll->syid,
			  							'classid' => $sched->classid,
			  							'paymentno' => $sched->paymentno,
			  							'particulars' => $sched->particulars,
			  							'duedate' => $sched->duedate,
			  							'amountdue' => $sched->amount,
			  							'balance' => $sched->amount
			  						]);		
			  				}
			  				else
			  				{
			  					$paysched = db::table('studpaysched')
			  						->insert([
			  							'enrollid' => $enroll->id,
			  							'studid' => $enroll->studid,
			  							'syid' =>$enroll->syid,
			  							'classid' => $sched->classid,
			  							'paymentno' => $sched->paymentno,
			  							'particulars' => 'TUITION/BOOK FEE - '. strtoupper(date('F', strtotime($sched->duedate))),
			  							'duedate' => $sched->duedate,
			  							'amountdue' => $sched->amount,
			  							'balance' => $sched->amount
			  						]);	
			  				}
			  				
			  			}
			  			

						}
					}
				}
			}
		}
	}
	public function discountamount(Request $request)
	{
		if($request->ajax())
		{
			$classid = $request->get('classid');
			$studid = $request->get('studid');
			$discountid = $request->get('discountid');

			// $studinfo = db::table('studinfo')
			// 		->select('studinfo.*', 'grantee.description')
			// 		->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
			// 		->where('studinfo.id', $studid)
			// 		->first();

			// return $studinfo;
			// $esc = $studinfo->grantee;

			// $syid = FinanceModel::getSYID();
			// $semid = FinanceModel::getsemID();

			// if($studinfo->levelid == 14 || $studinfo->levelid == 15)
			// {
			// 	$tuition = db::table('tuitionheader')
			// 			->select('tuitionheader.id', 'headerid', 'classificationid', 'amount', 'pschemeid', 'semid', 'syid')
			// 			->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
			// 			->where('levelid', $studinfo->levelid)
			// 			->where('grantee', $esc)
			// 			->where('classificationid', $classid)
			// 			->where('syid', $syid)
			// 			->where('semid', $semid)
			// 			->where('tuitionheader.deleted', 0)
			// 			->where('tuitiondetail.deleted', 0)
			// 			->get();

			// 	if(count($tuition) == 0)
			// 	{
			// 		$tuition = db::table('tuitionheader')
			// 			->select('tuitionheader.id', 'headerid', 'classificationid', 'amount', 'pschemeid', 'semid', 'syid')
			// 			->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
			// 			->where('levelid', $studinfo->levelid)
			// 			->where('classificationid', $classid)
			// 			->where('syid', $syid)
			// 			->where('semid', $semid)
			// 			->where('tuitionheader.deleted', 0)
			// 			->where('tuitiondetail.deleted', 0)
			// 			->get();					
			// 	}
			// }
			// else
			// {
			// 	$tuition = db::table('tuitionheader')
			// 			->select('tuitionheader.id', 'headerid', 'classificationid', 'amount', 'pschemeid', 'semid', 'syid')
			// 			->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
			// 			->where('levelid', $studinfo->levelid)
			// 			->where('grantee', $esc)
			// 			->where('classificationid', $classid)
			// 			->where('syid', $syid)
			// 			->where('tuitionheader.deleted', 0)
			// 			->where('tuitiondetail.deleted', 0)
			// 			->get();

			// 	if(count($tuition) == 0)
			// 	{
			// 		$tuition = db::table('tuitionheader')
			// 			->select('tuitionheader.id', 'headerid', 'classificationid', 'amount', 'pschemeid', 'semid', 'syid')
			// 			->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
			// 			->where('levelid', $studinfo->levelid)
			// 			->where('classificationid', $classid)
			// 			->where('syid', $syid)
			// 			->where('tuitionheader.deleted', 0)
			// 			->where('tuitiondetail.deleted', 0)
			// 			->get();					
			// 	}

				
			// }

			$studledger = db::table('studledger')
				->where('deleted', 0)
				->where('studid', $studid)
				->where('classid', $classid)
				->where('syid', FinanceModel::getSYID())
				->where('semid', FinanceModel::getSemID())
				->first();

			$discount = db::table('discounts')
					->where('id', $discountid)
					->first();

			if($discount->percent == 1)
			{
				$discAmount = ($studledger->amount /100) * $discount->amount;
			}
			else
			{
				$discAmount = $discount->amount;
			}

			$data = array(
				'discamount' => number_format($discAmount, 2)
			);

			echo json_encode($data);
		}
	}

	public function balforward()
	{
		return view('finance.balforward');
	}

	public function studbal(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');

			if($semid == 0)
			{
				$studledger = db::select('
						SELECT studid, lastname, firstname, middlename, suffix, levelid, amount, payment, SUM(amount) AS totalamount, SUM(payment) AS totalpayment
						FROM studledger
						INNER JOIN studinfo ON studledger.studid = studinfo.id
						WHERE levelid = ? AND studledger.syid = ? AND void = 0 and studledger.deleted = 0
						GROUP BY studid
						ORDER BY lastname, firstname
					', [$levelid, $syid]);
			}
			else
			{
				$studledger = db::select('
						SELECT studid, lastname, firstname, middlename, suffix, levelid, amount, payment, SUM(amount) AS totalamount, SUM(payment) AS totalpayment
						FROM studledger
						INNER JOIN studinfo ON studledger.studid = studinfo.id
						WHERE levelid = ? AND studledger.syid = ? AND studledger.semid = ? AND void = 0 and studledger.deleted = 0
						GROUP BY studid
						ORDER BY lastname, firstname
					', [$levelid, $syid, $semid]);
			}
				

			$list ='';
			$balance = 0;
			foreach($studledger as $ledger)
			{

				if(is_null($ledger->totalpayment))
				{
					$balance = $ledger->totalamount;
				}
				else
				{
					$balance = $ledger->totalamount - $ledger->totalpayment;
				}

				// echo '('. $ledger->studid . ' - ' . $balance . ') ';


				$studname = $ledger->lastname . ', ' . $ledger->firstname . ' ' . $ledger->middlename . ' ' . $ledger->suffix;
				if($balance > 0)
				{
					$list .='
						<tr>
	            <td class="stud-name">'.strtoupper($studname).'</td>
	            <td>'.number_format($ledger->totalamount, 2).'</td>
	            <td>'.number_format($ledger->totalpayment, 2).'</td>
	            <td>'.number_format($balance, 2).'</td>
	            <td style="width: 8px">
	              <button class="btn btn-primary bal-fwd" data-toggle="tooltip" data-id="'.$ledger->studid.'" data-value="'.$studname.'" title="Forward Balance"><i class="fas fa-external-link-alt"></i></button>
	            </td>
	            <td>
	              <button class="btn btn-success v-ledger" data-id="'.$ledger->studid.'" data-toggle="tooltip" title="View Ledger"><i class="fas fa-file-invoice"></i></button>
	            </td>
	          </tr>
					';
				}
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);

		}
	}

	public function loadstud(Request $request)
	{
		if($request->ajax())
		{
			$data = array(
				'list' => FinanceModel::loadstud()
			);
			echo json_encode($data);
		}
	}

	public function savefsetup(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$mopid = $request->get('mopid');
			$classid = $request->get('classid');

			$setup = db::table('balforwardsetup')
					->where('id', 1)
					->update([
						'syid' => $syid,
						'semid' => $semid,
						'mopid' => $mopid,
						'classid' => $classid
					]);

		}
	}

	public function loadbalfwdsetup(Request $request)
	{
		if($request->ajax())
		{
			$setup = db::table('balforwardsetup')
					->where('id', 1)
					->first();

			$data = array(
				'syid' => $setup->syid,
				'semid' => $setup->semid,
				'mopid' => $setup->mopid,
				'classid' => $setup->classid
			);

			echo json_encode($data);

		}
	}

	public function checkbalfwdsetup(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$mopid = $request->get('mopid');
			$classid = $request->get('classid');

			// return $classid;

			$setup = db::table('balforwardsetup')
					->where('id', 1)
					->first();

			if($syid == $setup->syid && $semid == $setup->semid && $mopid == $setup->mopid && $classid == $setup->classid)
			{
				return 0;
			}
			else
			{
				return 1;
			}
		}
	}

	public function fwdbal(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$syid = $request->get('syid');
			$manualamount = $request->get('manualamount');

			$cursy = DB::table('sy')
		        ->select('id', 'sydesc')
		        ->where('id', $syid)
		        ->first();


			$studinfo = db::table('studinfo')
					->where('id', $studid)
					->first();

			$fwdsetup = db::table('balforwardsetup')	
					->where('id', 1)
					->first();

			$fwdsy = $fwdsetup->syid;
			$fwdclass = $fwdsetup->classid;
			$fwdsem = $fwdsetup->semid;
			$fwdmop = $fwdsetup->mopid;


			$syear = DB::table('sy')
		        ->select('id', 'sydesc')
		        ->where('id', $fwdsy)
		        ->first();

      		$semester = db::table('semester')
	      		->where('id', $fwdsem)
	      		->first();

			if($studinfo->levelid == 14 || $studinfo->levelid == 15)
			{	
				$semid = $request->get('semid');

				$enrollstud = db::table('sh_enrolledstud')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('semid', $semid)
						->get();

				$fwdenrollstud = db::table('sh_enrolledstud')
						->where('studid', $studid)
						->where('syid', $fwdsy)
						->where('semid', $fwdsem)
						->get();	

				$studledger = db::select('
						SELECT studid, lastname, firstname, middlename, suffix, levelid, amount, payment, SUM(amount) AS totalamount, SUM(payment) AS totalpayment
						FROM studledger
						INNER JOIN studinfo ON studledger.studid = studinfo.id
						WHERE studid = ? AND studledger.syid = ? AND studledger.semid = ? AND void = 0 and studledger.deleted = 0
						GROUP BY studid
						ORDER BY lastname, firstname
					', [$studid, $syid, $semid]);


			}
			elseif($studinfo->levelid >= 17 && $studinfo->levelid <= 20)
			{
				$semid = $request->get('semid');

				$enrollstud = db::table('college_enrolledstud')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('semid', $semid)
						->get();

				$fwdenrollstud = db::table('college_enrolledstud')
						->where('studid', $studid)
						->where('syid', $fwdsy)
						->where('semid', $fwdsem)
						->get();	

				$studledger = db::select('
						SELECT studid, lastname, firstname, middlename, suffix, levelid, amount, payment, SUM(amount) AS totalamount, SUM(payment) AS totalpayment
						FROM studledger
						INNER JOIN studinfo ON studledger.studid = studinfo.id
						WHERE studid = ? AND studledger.syid = ? AND studledger.semid = ? AND void = 0 and studledger.deleted = 0
						GROUP BY studid
						ORDER BY lastname, firstname
					', [$studid, $syid, $semid]);				
			}
			else
			{
				$semid = 1;
				$enrollstud = db::table('enrolledstud')
						->where('studid', $studid)
						->where('syid', $syid)
						->get();

				$fwdenrollstud = db::table('enrolledstud')
						->where('studid', $studid)
						->where('syid', $fwdsy)
						->get();	

				$studledger = db::select('
						SELECT studid, lastname, firstname, middlename, suffix, levelid, amount, payment, SUM(amount) AS totalamount, SUM(payment) AS totalpayment
						FROM studledger
						INNER JOIN studinfo ON studledger.studid = studinfo.id
						WHERE studid = ? AND studledger.syid = ? AND void = 0 and studledger.deleted = 0
						GROUP BY studid
						ORDER BY lastname, firstname
					', [$studid, $syid]);
			}

			// return $studledger;
			if(count($studledger) > 0)
			{
				if(is_null($studledger[0]->totalpayment))
				{
					$studbal = $studledger[0]->totalamount;
				}
				else
				{
					$studbal = $studledger[0]->totalamount - $studledger[0]->totalpayment;
				}

				$particularsTO = 'Balance forwarded to SY ' . $syear->sydesc . ' ' . $semester->semester;

				$ledgerIns = db::table('studledger')
					->insert([
						'studid' => $studid,
						// 'enrollid' => $enrollstud->id,
						'syid' => $syid,
						'semid' => $semid,
						'classid' => $fwdclass,
						'particulars' => $particularsTO,
						'amount' => 0,
						'payment' => $studbal,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime(),
						'deleted' => 0,
						'void' => 0
					]);
			}
			else
			{
				$studbal = $manualamount;

				$ledgerIns = db::table('studledger')
					->insert([
						'studid' => $studid,
						// 'enrollid' => $enrollstud->id,
						'syid' => $syid,
						'semid' => $semid,
						'classid' => $fwdclass,
						'particulars' => 'Balance for SY: ' . $cursy->sydesc,
						'amount' => $studbal,
						'payment' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime(),
						'deleted' => 0,
						'void' => 0
					]);

				$particularsTO = 'Balance forwarded to SY ' . $syear->sydesc . ' ' . $semester->semester;

				$ledgerIns = db::table('studledger')
					->insert([
						'studid' => $studid,
						// 'enrollid' => $enrollstud->id,
						'syid' => $syid,
						'semid' => $semid,
						'classid' => $fwdclass,
						'particulars' => $particularsTO,
						'amount' => 0,
						'payment' => $studbal,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime(),
						'deleted' => 0,
						'void' => 0
					]);
			}			
			
			if($studinfo->levelid == 14 || $studinfo->levelid == 15)
			{
				$paysched = db::table('studpayscheddetail')
						->where('studid', $studid)
						->where('semid', $semid)
						->where('syid', $syid)
						->where('deleted', 0)
						->get();
			}	
			else
			{
				$paysched = db::table('studpayscheddetail')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('deleted', 0)
						->get();
			}

			foreach($paysched as $pay)
			{
				$upd = db::table('studpayscheddetail')
						->where('id', $pay->id)
						->update([
							'amountpay' => $pay->amount,
							'balance' => 0,
							'updateddatetime' => FinanceModel::getServerDateTime(),
              'updatedby' => auth()->user()->id
						]);
			}

			$fromsyear = DB::table('sy')
		        ->select('id', 'sydesc')
		        ->where('id', $syid)
		        ->first();

			$fromsemester = db::table('semester')
				->where('id', $semid)
				->first();

			// echo $fromsemester;

			$particularsFROM = 'Balance forwarded from SY ' . $fromsyear->sydesc . ' ' . $fromsemester->semester;



			$ledgerfwd = db::table('studledger')
				->insert([
					'studid' => $studid,
					// 'enrollid' => $fwdenrollstud->id,
					'syid' => $fwdsy,
					'semid' => $fwdsem,
					'classid' => $fwdclass,
					'particulars' => $particularsFROM,
					'amount' => $studbal,
					'payment' => 0,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime(),
					'deleted' => 0,
					'void' => 0
				]);

			//StudledgerItemized
			db::table('studledgeritemized')
				->insert([
					'studid' => $studid,
					'syid' => $fwdsy,
					'semid' => $fwdsem, 
					'classificationid' => $fwdclass,
					'itemamount' => $studbal,
					'deleted' => 0,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

			$mopheader = db::table('paymentsetup')
				->where('id', $fwdmop)
				->first();

			$fwdAmount = (float)$studbal / (int)$mopheader->noofpayment;

			$mopdetail = db::table('paymentsetupdetail')
					->where('paymentid', $fwdmop)
					->where('deleted', 0)
					->get();

			foreach($mopdetail as $mop)
			{
				$inspaysched = db::table('studpayscheddetail')
						->insert([
							'studid' => $studid,
							// 'enrollid' => $fwdenrollstud->id,
							'syid' => $fwdsy,
							'semid' => $fwdsem,
							'tuitiondetailid' => 0,
							'classid' => $fwdclass,
							'paymentno' => $mop->paymentno,
							'particulars' => $particularsFROM,
							'duedate' => $mop->duedate,
							'amount' => $fwdAmount,
							'amountpay' => 0,
							'balance' => $fwdAmount,
							'deleted' => 0
						]);
			}

		}
	}

	public function fwdVledger(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$balance = 0;
			

			$studinfo = db::table('studinfo')
					->select('lastname', 'firstname', 'middlename', 'suffix', 'levelid', 'levelname')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->where('studinfo.id', $studid)
					->first();

			$studname = $studinfo->lastname . ', ' . $studinfo->firstname . ' ' . $studinfo->middlename . ' ' . $studinfo->suffix . ' - ' . $studinfo->levelname;

			$list = '';

			if($studinfo->levelid == 14 || $studinfo->levelid == 15)
			{
				$studledger = db::table('studledger')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('semid', $semid)
						->where('deleted', 0)
						->get();

				$debit = 0;
				$credit = 0;
				$tdebit = 0;
				$tcredit = 0;
				
				foreach($studledger as $ledger)
				{
					if($ledger->amount > 0)
					{
						$debit = number_format($ledger->amount, 2);
					}
					else
					{
						$debit = '';
					}

					if($ledger->payment > 0)
					{
						$credit = number_format($ledger->payment, 2);
					}
					else
					{
						$credit = '';
					}
					
					if($ledger->void == 0)
					{
						$balance += $ledger->amount - $ledger->payment;
						$tdebit += $ledger->amount;
						$tcredit += $ledger->payment;
						
						$ldate = date_create($ledger->createddatetime);
						$ldate = date_format($ldate, 'm-d-Y');

						$list .='
							<tr>
                <td>'.$ldate.'</td>
                <td>'.$ledger->particulars.'</td>
                <td class="text-right">'.$debit.'</td>
                <td class="text-right">'.$credit.'</td>
                <td class="text-right">'.number_format($balance, 2).'</td>
              </tr>
						';
					}
					else
					{
						$list .='
							<tr>
                <td class="text-danger"><del>'.$ldate.'</del></td>
                <td class="text-danger"><del>'.$ledger->particulars.'</del></td>
                <td class="text-danger text-right"><del>'.$debit.'</del></td>
                <td class="text-danger text-right"><del>'.$credit.'</del></td>
                <td class="text-danger text-right"><del>'.number_format($balance, 2).'</del></td>
              </tr>
						';	
					}
				}

			}
			else
			{
				$studledger = db::table('studledger')
						->where('studid', $studid)
						->where('syid', $syid)
						->where('deleted', 0)
						->get();

				$tdebit = 0;
				$tcredit = 0;
				$debit = 0;
				$credit = 0;

				foreach($studledger as $ledger)
				{

					if($ledger->amount > 0)
					{
						$debit = number_format($ledger->amount, 2);
					}
					else
					{
						$debit = '';
					}

					if($ledger->payment > 0)
					{
						$credit = number_format($ledger->payment, 2);
					}
					else
					{
						$credit = '';
					}


					if($ledger->void == 0)
					{
						$balance += $ledger->amount - $ledger->payment;
						$tdebit += $ledger->amount;
						$tcredit += $ledger->payment;
						
						$ldate = date_create($ledger->createddatetime);
						$ldate = date_format($ldate, 'm-d-Y');

						$list .='
							<tr>
                <td>'.$ldate.'</td>
                <td>'.$ledger->particulars.'</td>
                <td class="text-right">'.$debit.'</td>
                <td class="text-right">'.$credit.'</td>
                <td class="text-right">'.number_format($balance, 2).'</td>
              </tr>
						';
					}
					else
					{
						$list .='
							<tr>
                <td class="text-danger"><del>'.$ldate.'</del></td>
                <td class="text-danger"><del>'.$ledger->particulars.'</del></td>
                <td class="text-danger text-right"><del>'.$debit.'</del></td>
                <td class="text-danger text-right"><del>'.$credit.'</del></td>
                <td class="text-danger text-right"><del>'.number_format($balance, 2).'</del></td>
              </tr>
						';	
					}
				}
				$list .= '
					<tr class="bg-primary">
          <th></th>
          <th style="text-align:right">
            <h5>
              TOTAL:
            </h5>
          </th>
          <th class="text-right">
            <h5>
              <u>'.number_format($tdebit, 2).'</u>
            </h5>
          </th>
          <th class="text-right">
            <h5>
              <u>'.number_format($tcredit, 2).'</u>
            </h5>
          </th>
          <th class="text-right">
          	<h5>
              <u>'.number_format($balance, 2).'</u>
            </h5>
          </th>
        </tr>
				';
			}

			$data = array(
				'list' => $list,
				'studname' => strtoupper($studname)
			);

			echo json_encode($data);

		}
	}

	public function checkExist(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			$balfwdinfo = db::table('balforwardsetup')
					->where('id', 1)
					->first();

			$syid = $balfwdinfo->syid;
			$semid = $balfwdinfo->semid;
			$classid = $balfwdinfo->classid;

			$studledger = Db::table('studledger')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('semid', $semid)
					->get();

			$fwdcount = 0;
			$bal = 0;
			foreach($studledger as $ledger)
			{
				if($ledger->classid == $classid)
				{
					$fwdcount += 1;
				}

				$bal += $ledger->amount - $ledger->payment;
			}


			if($fwdcount > 0)
			{
				return 1;
			}
			else
			{
				return 0;
			}
		}
	}

	public function listfwdbal(Request $request)
	{
		if($request->ajax())
		{
			$fwdsetup = db::table('balforwardsetup')
					->where('id', 1)
					->first();

			$studledger = db::table('studledger')
					->select('studledger.id', 'studinfo.id as studid', 'lastname', 'firstname', 'middlename', 'suffix', 'amount')
					->join('studinfo', 'studledger.studid', '=', 'studinfo.id')
					->where('studledger.syid', $fwdsetup->syid)
					->where('studledger.semid', $fwdsetup->semid)
					->where('studledger.classid', $fwdsetup->classid)
					->orderBy('lastname', 'ASC')
					->orderBy('firstname', 'ASC')
					->get();

			$list = '';

			foreach($studledger as $ledger)
			{
				$name = $ledger->lastname . ', ' . $ledger->firstname . ' ' . $ledger->middlename. ' ' . $ledger->suffix;
				$list .='
					<tr>
						<td>'.strtoupper($name).'</td>
						<td>'.number_format($ledger->amount, 2).'</td>
					</tr>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);

		}
	}

	public function fwdbalpdf(Request $request)
	{
		$syid = $request->input('hsy');
		$semid = $request->input('hsem');
		$classid = $request->input('hclassid');

		$sinfo = db::table('schoolinfo')
				->first();

		$syinfo = db::table('sy')
				->where('id', $syid)
				->first();

		$fwdsetup = db::table('balforwardsetup')
					->where('id', 1)
					->first();

		$studledger = db::table('studledger')
				->select('studledger.id', 'studinfo.id as studid', 'lastname', 'firstname', 'middlename', 'suffix', 'amount', 'levelname')
				->join('studinfo', 'studledger.studid', '=', 'studinfo.id')
				->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
				->where('studledger.syid', $fwdsetup->syid)
				->where('studledger.semid', $fwdsetup->semid)
				->where('studledger.classid', $fwdsetup->classid)
				->orderBy('lastname', 'ASC')
				->orderBy('firstname', 'ASC')
				->get();

		$datetime = FinanceModel::getServerDateTime();

		$curDate = date_create(FinanceModel::getServerDateTime());
		$curDate = date_format($curDate, 'm-d-Y h:i A');


		$pdf = PDF::loadview('finance.fwdbalpdf', compact('studledger', 'curDate', 'sinfo', 'syinfo'));

		return $pdf->stream('forwardedbalance '. $datetime .'.pdf');

	}

	public function expenses()
	{
		return view('finance.expenses');
	}
	public function salaryrateelevation($id, Request $request)
	{   
		date_default_timezone_set('Asia/Manila');
		if($id == 'reloadcount'){
			$data = array(
				'rateCount' => FinanceModel::countPendingRateElevationRequests(),
				'OLpayCount' => FinanceModel::countOnlinePayment()
			);
			
			echo json_encode($data);
		}
		elseif($id == 'view'){
			$rateelevation = Db::table('hr_rateelevation')
				->select(
					'hr_rateelevation.id',
					'hr_rateelevation.oldsalary',
					'hr_rateelevation.newsalary',
					'hr_rateelevation.createddatetime',
					'hr_rateelevation.status',
					'teacher.id as teacherid',
					'teacher.firstname',
					'teacher.middlename',
					'teacher.lastname',
					'teacher.suffix',
					'usertype.utype'
				)
				->join('teacher','hr_rateelevation.employeeid','=','teacher.id')
				->leftJoin('usertype','teacher.usertypeid','=','usertype.id')
				->where('hr_rateelevation.deleted','0')
				// ->where('hr_rateelevation.newsalary','!=',DB::raw('hr_rateelevation.oldsalary'))
				->orderBy('hr_rateelevation.status','asc')
				->get();
				
			if(count($rateelevation) > 0){
	
				foreach($rateelevation as $rateelev){
	
					$rateelev->submitteddate = date('F d, Y',strtotime($rateelev->createddatetime));
	
				}
	
			}
			
			return view('finance.rateelevation')
				->with('rateelevation',$rateelevation);
		}else{

			if($request->get('action') == 'approve'){
				$action = '1';
			}else{
				$action = '2';
			}
			
			$getupdatedsalary = DB::table('hr_rateelevation')
			    ->where('id', $request->get('id'))
				->where('employeeid',$request->get('employeeid'))
				->where('deleted','0')
				// ->where('status',$action)
				->first();

			if($request->get('action') == 'approve'){
				$amount = $getupdatedsalary->newsalary;
			}else{
				$amount = $getupdatedsalary->oldsalary;
			}

			// return $amount;
			DB::table('hr_rateelevation')
			    ->where('id', $request->get('id'))
				->where('employeeid', $request->get('employeeid'))
				->where('deleted','0')
				->update([
					'status' => $action,
					'updateddatetime' => date('Y-m-d H:i:s')
				]);

			DB::table('employee_basicsalaryinfo')
					->where('employeeid',$request->get('employeeid'))
					->update([
						'amount'	=>  $amount,
						'rateelevationstatus' => 0
					]);

			// return back();
		}
	}

	public function saveexpense(Request $request)
	{
		if($request->ajax())
		{
			$description = $request->get('description');
			$transdate = $request->get('transdate');
			$requestby = $request->get('requestby');
			$remarks = $request->get('remarks');
			$paidby = $request->get('paidby');
			$trans = $request->get('trans');
			$dataid = $request->get('dataid');


			if($trans == 1)
			{
				$delete = 0;
			}
			else
			{
				$delete = 1;
			}


			
			if($dataid == '')
			{
				$ins = db::table('expense')
						->insertGetId([
							'description' => $description,
							'requestedbyid' => $requestby,
							'amount' => 0,
							'transdate' => $transdate,
							'paidby' => $paidby,
							'status' => 'SUBMITTED',
							'remarks' => $remarks,
							'createdby' => auth()->user()->id,
							'deleted' => $delete
						]);
				
				$refnum = 'EXP-' . sprintf('%06d', $ins);

				$saveRef = db::table('expense')
						->where('id', $ins)
						->update([
							'description' => $description,
							'requestedbyid' => $requestby,
							'amount' => 0,
							'transdate' => $transdate,
							'paidby' => $paidby,
							'status' => 'SUBMITTED',
							'refnum' => $refnum,
							'remarks' => $remarks,
							'createdby' => auth()->user()->id,
							'deleted' => $delete
						]);
			}
			else
			{


				$expense = db::table('expense')
					->where('id', $dataid)
					->first();

				if($expense->status == 'SUBMITTED')
				{
					$gt = db::table('expensedetail')
						->where('headerid', $dataid)
						->where('deleted', 0)
						->sum('total');

					// return $gt;


					$ins = db::table('expense')
						->where('id', $dataid)
						->update([
							'description' => $description,
							'requestedbyid' => $requestby,
							'amount' => $gt,
							'transdate' => $transdate,
							'paidby' => $paidby,
							'status' => 'SUBMITTED',
							// 'refnum' => $refnum . $ins,
							'remarks' => $remarks,
							'createdby' => auth()->user()->id,
							'deleted' => $delete
						]);
				}

			}

			return $ins;

		}
	}

	public function searchexpenses(Request $request)
	{
		if($request->ajax())
		{
			$filter = $request->get('filter');
			$datefrom = $request->get('datefrom');
			$dateto = $request->get('dateto');

			$datefrom = date_create($datefrom);
			$datefrom = date_format($datefrom, 'Y-m-d 00:00');

			$dateto = date_create($dateto);
			$dateto = date_format($dateto, 'Y-m-d 23:59');

			// return $filter;

			$expenses = db::table('expense')
					->select('expense.id as expenseid', 'transdate', 'description', 'name', 'amount', 'status', 'refnum')
					->join('users', 'expense.requestedbyid', '=', 'users.id')
					->where('description', 'like', '%'.$filter.'%')
					->where('expense.deleted', 0)
					->whereBetween('transdate', [$datefrom, $dateto])
					->orWhere('refnum', 'like', '%'.$filter.'%')
					->where('expense.deleted', 0)
					->whereBetween('transdate', [$datefrom, $dateto])
					->orderBy('status', 'DESC')
					->orderBy('expense.id', 'DESC')
					->get();

			// echo ' ' . $datefrom . ' - ' . $dateto . ' ' . $filter;

			// return $expenses;
			$total = 0;
			if(count($expenses) > 0)
			{
				$list = '';
				foreach($expenses as $expense)
				{
					$total += $expense->amount;
					$tdate = date_create($expense->transdate);
					$tdate = date_format($tdate, 'm-d-Y');
					
					if($expense->status == 'SUBMITTED')
					{
						$list .='
							<tr class="expense-tr" data-id="'.$expense->expenseid.'">
							<td>'.$expense->refnum.'</td>
								<td>'.$expense->description.'</td>
								<td>'.$tdate.'</td>
								<td>'.$expense->name.'</td>
								<td class="text-right">'.number_format($expense->amount, 2).'</td>
								<td>'.$expense->status.'</td>
							</tr>
						';
					}
					else if($expense->status == 'APPROVED')
					{
						$list .='
							<tr class="expense-tr text-success" data-id="'.$expense->expenseid.'">
							<td>'.$expense->refnum.'</td>
								<td>'.$expense->description.'</td>
								<td>'.$tdate.'</td>
								<td>'.$expense->name.'</td>
								<td class="text-right">'.number_format($expense->amount, 2).'</td>
								<td>'.$expense->status.'</td>
							</tr>
						';	
					}
					else if($expense->status == 'DISAPPROVED')
					{
						$list .='
							<tr class="expense-tr text-danger" data-id="'.$expense->expenseid.'">
							<td>'.$expense->refnum.'</td>
								<td>'.$expense->description.'</td>
								<td>'.$tdate.'</td>
								<td>'.$expense->name.'</td>
								<td class="text-right">'.number_format($expense->amount, 2).'</td>
								<td>'.$expense->status.'</td>
							</tr>
						';	
					}
				}

				$data = array(
					'list' => $list,
					'gtotal' => '<td colspan="5" class="text-right text-bold">TOTAL: <span class="text-success">'.number_format($total, 2).'</span></td>'
				);

				echo json_encode($data);
			}
		}
	}

	public function saveexpensedetail(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');
			$itemid = $request->get('itemid');
			$itemprice = str_replace(',', '', $request->get('itemprice'));
			$qty = $request->get('qty');
			$total = str_replace(',', '', $request->get('total'));
			$detailid = $request->get('detailid');


			if($detailid == 0)
			{
				$insitem = db::table('expensedetail')
					->insert([
						'headerid' => $headerid,
						'itemid' =>$itemid,
						'itemprice' => $itemprice,
						'qty' => $qty,
						'total' => $total,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				$upditem = db::table('expensedetail')
					->where('id', $detailid)
					->update([
						'headerid' => $headerid,
						'itemid' =>$itemid,
						'itemprice' => $itemprice,
						'qty' => $qty,
						'total' => $total,
						'deleted' => 0,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);	
			}
		}
	}

	public function loadexpensedetail(Request $request)
	{
		$headerid = $request->get('headerid');

		$details = db::table('expensedetail')
				->select('expensedetail.id', 'items.description', 'itemprice', 'qty', 'total')
				->leftjoin('items', 'expensedetail.itemid', '=', 'items.id')
				->where('headerid', $headerid)
				->where('expensedetail.deleted', 0)
				->get();

		$list = '';

		$gtotal = 0;

		foreach($details as $detail)
		{
			$gtotal += $detail->total;
			$list .='
				<tr data-id="'.$detail->id.'">
				  <td>'.$detail->description.'</td>
				  <td class="text-right">'.number_format($detail->itemprice, 2).'</td>
				  <td class="text-center">'.$detail->qty.'</td>
				  <td class="text-right">'.number_format($detail->total, 2).'</td>
				</tr>
			';
		}

		if($gtotal > 0)
		{
			$grandtotal = '
				<td colspan="4" class="text-right text-bold">TOTAL: <span id="gt" class="text-success text-lg">'.number_format($gtotal, 2).'</span></td>
			';
		}
		else
		{
			$grandtotal = '';
		}
		$data = array(
			'list' => $list,
			'gtotal' => $grandtotal
		);

		echo json_encode($data);
	}

	public function loadexpense(Request $request)
	{
		if($request->ajax())
		{
			$headerid = $request->get('headerid');

			$expense = db::table('expense')
					->where('id', $headerid)
					->first();

			$transdate = date_create($expense->transdate);
			$transdate = date_format($transdate, 'Y-m-d');

			$data = array(
				'description' => $expense->description,
				'requestedbyid' => $expense->requestedbyid,
				'transdate' => $transdate,
				'paidby' => $expense->paidby,
				'status' => $expense->status,
				'refnum' => $expense->refnum,
				'remarks' => $expense->remarks
			);

			echo json_encode($data);

		}
	}

	public function loadexpenseitems(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');
			$items = FinanceModel::expenseitems();

			$list = '';
			foreach($items as $item)
			{
				if($itemid == $item->id)
				{
					$list .= '
						<option value="'.$item->id.'" selected>'.$item->description.'</option>
					';
				}
				else
				{
					$list .= '
						<option value="'.$item->id.'">'.$item->description.'</option>
					';
				}
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function approveexpense(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$chkstatus = db::table('expense')
				->where('id', $dataid)
				->first();



			if($chkstatus->status == 'SUBMITTED')
			{
				$chkelevate = db::table('chrngpermission')
					->where('userid', auth()->user()->id)
					->count();

				

				if($chkelevate > 0)
				{
					$expense = db::table('expense')
						->where('id', $dataid)
						->update([
							'status' => 'APPROVED',
							'approveby' => auth()->user()->id,
							'approveddatetime' => FinanceModel::getServerDateTime(),
							'updatedby' => auth()->user()->id,
							'updateddatetime' => FinanceModel::getServerDateTime()
						]);	

					return 1;
				}
				else
				{
					return 0;
				}
			}
			else
			{
				return 2;
			}
		}
	}

	public function disapproveexpense(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$chkstatus = db::table('expense')
				->where('id', $dataid)
				->first();



			if($chkstatus->status == 'SUBMITTED')
			{
				$chkelevate = db::table('chrngpermission')
					->where('userid', auth()->user()->id)
					->count();

				

				if($chkelevate > 0)
				{
					$expense = db::table('expense')
						->where('id', $dataid)
						->update([
							'status' => 'DISAPPROVED',
							'approveby' => auth()->user()->id,
							'approveddatetime' => FinanceModel::getServerDateTime(),
							'updatedby' => auth()->user()->id,
							'updateddatetime' => FinanceModel::getServerDateTime()
						]);	

					return 1;
				}
				else
				{
					return 0;
				}
			}
			else
			{
				return 2;
			}
		}
	}

	public function expenseItemInfo(Request $request)
	{
		if($request->ajax())
		{
			$detailid = $request->get('detailid');

			$detail = db::table('expensedetail')
				->where('id', $detailid)
				->first();

			$data = array(
				'itemid' => $detail->itemid,
				'itemprice' => $detail->itemprice,
				'qty' => $detail->qty,
				'total' => $detail->total,
			);

			echo json_encode($data);
		}
	}


	public function saveNewItem(Request $request)
	{
		if($request->ajax())
		{
			$itemcode = $request->get('itemcode');
			$itemdesc = $request->get('itemdesc');
			$classid = $request->get('classid');
			$amount = $request->get('amount');
			$isexpense = $request->get('isexpense');

			$itemid = db::table('items')
					->insertGetId([
						'itemcode' => $itemcode,
						'description' => $itemdesc,
						'classid' => $classid,
						'amount' => $amount,
						'isdp' => 0,
						'isreceivable' => 0,
						'isexpense' => 1,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

			return $itemid;

		}
	}

	public function onlinepay(Request $request)
	{
		return view('finance/onlinepayment');
	}

	public function onlinepaymentlist(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$filter = $request->get('filter');

			$payments = '';

			$lists = db::table('onlinepayments')
					->select('onlinepayments.*', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 
						'paymenttype.description', 'amount')
					->leftjoin('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.qcode')
					->join('paymenttype', 'onlinepayments.paymentType', '=', 'paymenttype.id')
					->leftjoin('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->where('isapproved', 0)
					->orderBy('id', 'DESC')
					->get();

			// return $lists;

			foreach($lists as $list)
			{
				// echo $list->queingcode . ';';
				$studinfo = DB::table('studinfo')
					->where('qcode', $list->queingcode)
					->count();
					// return $studinfo;
				if($studinfo > 0)
				{
					// echo ' true;';
					$studname = $list->lastname . ', ' . $list->firstname . ' ' . $list->middlename . ' ' . $list->suffix;
					$payments .='
						<tr style="cursor: pointer;" data-id="'.$list->id.'">
							<td>'.strtoupper($studname).'</td>
							<td>'.$list->queingcode.'</td>
							<td>'.$list->description.'</td>
							<td>'.number_format($list->amount, 2).'</td>
							<td></td>
						</tr>
					';
				}
				else
				{
					// echo ' false;';
					$preregistration = db::table('preregistration')
						->where('queing_code', $list->queingcode)
						->first();

					
					if($preregistration)
					{
						// echo ' '.$preregistration . ';';	
						$studname = $preregistration->last_name . ', ' . $preregistration->first_name . ' ' . $preregistration->middle_name . ' ' . $preregistration->suffix;
						$payments .='
							<tr class="text-danger" style="cursor: pointer;" data-id="'.$list->id.'">
								<td>'.strtoupper($studname).'</td>
								<td>'.$list->queingcode.'</td>
								<td>'.$list->description.'</td>
								<td>'.number_format($list->amount, 2).'</td>
								<td id="checkStatus">NOT REGISTRED</td>
							</tr>
						';	
					}
				}
			}

			$lists = db::table('onlinepayments')
					// ->select('onlinepayments.*', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'refnum', 'paymenttype.description', 'amount', 'semid')
					->select(db::raw('onlinepayments.*, concat(lastname, ", ", firstname) as fname, middlename, levelname, refnum, paymenttype.description, amount, semester, levelid'))
					->leftjoin('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.sid')
					->join('paymenttype', 'onlinepayments.paymentType', '=', 'paymenttype.id')
					->leftjoin('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('semester', 'onlinepayments.semid', '=', 'semester.id')
					->where('isapproved', 0)
					->where('syid', $syid)
					->having('fname', 'like', '%'.$filter.'%')
					->orderBy('id', 'DESC')
					->get();



			foreach($lists as $list)
			{
				// $studinfo = DB::table('studinfo')
				// 	->where('qcode', $list->queingcode)
				// 	->count();



				$studname = $list->fname . ' ' . $list->middlename;
				$payments .='
					<tr style="cursor: pointer;" data-id="'.$list->id.'">
			            <td>'.strtoupper($studname).'</td>
			            <td>'.$list->levelname.'</td>
			            <td>'.$list->refnum.'</td>
			            <td>'.$list->description.'</td>
			            <td>'.number_format($list->amount, 2).'</td>
			            <td>'.$list->semester.'</td>
          			</tr>
				';
			}


			$lists = db::table('onlinepayments')
					->select('onlinepayments.*', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 
						'paymenttype.description', 'amount')
					->leftjoin('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.lrn')
					->join('paymenttype', 'onlinepayments.paymentType', '=', 'paymenttype.id')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->where('isapproved', 0)
					->orderBy('id', 'DESC')
					->get();


			foreach($lists as $list)
			{
				$studname = $list->lastname . ', ' . $list->firstname . ' ' . $list->middlename . ' ' . $list->suffix;
				$payments .='
					<tr style="cursor: pointer;" data-id="'.$list->id.'">
			            <td>'.strtoupper($studname).'</td>
			            <td>'.$list->refnum.'</td>
			            <td>'.$list->description.'</td>
			            <td>'.number_format($list->amount, 2).'</td>
			            <td></td>
          			</tr>
				';
			}






			$data = array(
					'list' => $payments
				);

			echo json_encode($data);

		}
	}
	
	public function paydata(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$info = db::table('onlinepayments')
					->select('onlinepayments.*', 'levelname', 'paymenttype.description', 
						'lastname', 'firstname', 'middlename', 'suffix', 'contactno', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.qcode')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->where('onlinepayments.id', $dataid)
					->get();

			if(count($info) == 0)
			{
				$info = db::table('onlinepayments')
					->select('onlinepayments.*', 'levelname', 'paymenttype.description', 
						'lastname', 'firstname', 'middlename', 'suffix', 'contactno', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.sid')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->where('onlinepayments.id', $dataid)
					->get();	


				if(count($info) == 0)
				{
					$info = db::table('onlinepayments')
					->select('onlinepayments.*', 'levelname', 'paymenttype.description', 
						'lastname', 'firstname', 'middlename', 'suffix', 'contactno', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.lrn')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->where('onlinepayments.id', $dataid)
					->get();						
				}

			}

			// $info = db::table('onlinepayments')
			// 		->select('onlinepayments.*', 'levelname', 'paymenttype.description', 
			// 			'lastname', 'firstname', 'middlename', 'suffix', 'contactno', 'onlinepayments.picurl')
			// 		->join('studinfo', function($join){
			// 				$join->on('onlinepayments.queingcode','=','studinfo.qcode');

			// 		})
			// 		->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
			// 		->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
			// 		->where('onlinepayments.id', $dataid)
			// 		->first();

			$studname = $info[0]->lastname . ', ' . $info[0]->firstname . ' ' . $info[0]->middlename . ' ' . $info[0]->suffix;

			$tdate = $info[0]->TransDate;

			$tdate = date_create($tdate);
			$tdate = date_format($tdate, 'm-d-Y');
			
			$url = db::table('schoolinfo')->first()->es_cloudurl;

			$data = array(
				'studname' => strtoupper($studname),
				'contactno' => $info[0]->contactno,
				'levelname' => $info[0]->levelname,
				'amount' => number_format($info[0]->amount, 2),
				'paymenttype' => $info[0]->description,
				'picurl' => $url . $info[0]->picurl,
				'transdate' => $tdate,
				'refnum' => $info[0]->refNum
			);

			echo json_encode($data);
		}
	}

	public function approvepay(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$nodp = $request->get('nodp');


			if($nodp == 0)
			{
				$info = db::table('onlinepayments')
						->where('id', $dataid)
						->update([
							'isapproved' => 1,
							'updateddatetime' => FinanceModel::getServerDateTime(),
							'updatedby' => auth()->user()->id
						]);

				return 1;
			}
			else
			{

				$onlinepayments = db::table('onlinepayments')
					->where('id', $dataid)
					->first();

				$studinfo = db::table('studinfo')
					->where('lrn', $onlinepayments->queingcode)
					->get();

				if(count($studinfo) == 0)
				{
					$studinfo = db::table('studinfo')
						->where('sid', $onlinepayments->queingcode)
						->get();

					if(count($studinfo) == 0)
					{
						$studinfo = db::table('studinfo')
							->where('qcode', $onlinepayments->queingcode)
							->get();

						if(count($studinfo) == 0)
						{
							return 2;
						}
						else
						{
							$this->updatenodp($studinfo[0]->id);
							$info = db::table('onlinepayments')
								->where('id', $dataid)
								->update([
									'isapproved' => 6,
									'updateddatetime' => FinanceModel::getServerDateTime(),
									'updatedby' => auth()->user()->id
								]);
							return 1;

						}

					}
					else
					{
						$this->updatenodp($studinfo[0]->id);
						$info = db::table('onlinepayments')
							->where('id', $dataid)
							->update([
								'isapproved' => 6,
								'updateddatetime' => FinanceModel::getServerDateTime(),
								'updatedby' => auth()->user()->id
								
							]);
						return 1;
					}

				}
				else
				{
					$this->updatenodp($studinfo[0]->id);
					$info = db::table('onlinepayments')
						->where('id', $dataid)
						->update([
							'isapproved' => 6,
							'updateddatetime' => FinanceModel::getServerDateTime(),
							'updatedby' => auth()->user()->id,
						]);
					return 1;
				}

			}
		}
	}

	public function updatenodp($studid)
	{
		$studinfo = db::table('studinfo')
			->where('id', $studid)
			->update([
				'nodp' => 1,
				'allownodpby' => auth()->user()->id,
				'allownodpdatetime' => FinanceModel::getServerDateTime(),
				'updateddatetime' => FinanceModel::getServerDateTime(),
				'updatedby' => auth()->user()->id,
			]);
	}

	public function saveolAmount(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$amount = $request->get('amount');

			$onlinepay = db::table('onlinepayments')
					->where('id', $dataid)
					->update([
						'amount' => $amount,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

			$data = array(
				'amount' => number_format($amount, 2)
			);

			echo json_encode($data);

		}
	}

	public function saveolDate(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$date = $request->get('curdate');

		$onlinepay = db::table('onlinepayments')
				->where('id', $dataid)
				->update([
					'TransDate' => $date,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

		$date = date_create($date);

		$data = array(
			'date' => date_format($date, 'm-d-Y')
		);

		echo json_encode($data);			
		}
	}

	public function saveolpaytype(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$paytypeid  = $request->get('paytypeid');

			$onlinepay = db::table('onlinepayments')
				->where('id', $dataid)
				->update([
					'paymentType' => $paytypeid,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

			$paytype = db::table('paymenttype')
					->where('id', $paytypeid)
					->first();

			$data = array(
				'paymenttype' => $paytype->description
			);

			echo json_encode($data);

		}
	}

	public function saveolrefnum(Request $request)
	{
		if($request->ajax())
		{
			$refnum = $request->get('refnum');
			$dataid = $request->get('dataid');

			$stat = 0;

			$olinfo = db::table('onlinepayments')
					->where('refNum', $refnum)
					->where('id', '!=', $dataid)
					->count();

			// return $olinfo;

			if($olinfo > 0)
			{
				$stat = 1;
			}
			else
			{
				$stat = 0;

				$ol = db::table('onlinepayments')
						->where('id', $dataid)
						->update([
							'refNum' => $refnum,
							'updateddatetime' => FinanceModel::getServerDateTime(),
							'updatedby' => auth()->user()->id
						]);
			}

			$ol = db::table('onlinepayments')
					->where('id', $dataid)
					->first();


			$data = array(
				'stat' => $stat,
				'refnum' => $ol->refNum
			);

			echo json_encode($data);
		}
	}

	public function saveoldisapprove(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$remarks = $request->get('remarks');

			$olpay = db::table('onlinepayments')
					->where('id', $dataid)
					->update([
						'remarks' => $remarks,
						'isapproved' => 2,
						'updateddatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id
					]);
		}
	}

	public function validatedupSY(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('syid');

			$fees = db::table('tuitionheader')
					->where('syid', $syid)
					->where('deleted', 0)
					->get();
				
			// return $fees;

			if(count($fees) > 0)
			{
				return 1;
			}
			else
			{
				return 0;
			}

		}
	}

	public function duplicateAll(Request $request)
	{
		if($request->ajax())	
		{
			$cursy = $request->get('cursy');
			$syid = $request->get('syid');

			$tuitionheader = db::table('tuitionheader')
					->where('syid', $cursy)
					->where('deleted', 0)
					->get();

			foreach($tuitionheader as $theader)
			{
				$headerid = db::table('tuitionheader')
					->insertGetId([
						'description' => $theader->description,
						'syid' => $syid,
						'levelid' => $theader->levelid,
						'grantee' => $theader->grantee,
						'semid' => $theader->semid,
						'strandid' => $theader->strandid,
						'deleted' => 0,
						'createddatetime' => FinanceModel::getServerDateTime(),
						'createdby' => auth()->user()->id
					]);

				$tuitiondetail = db::table('tuitiondetail')
						->where('headerid', $theader->id)
						->where('deleted', 0)
						->get();

				foreach($tuitiondetail as $tdetail)
				{
					$tdetailid = db::table('tuitiondetail')
							->insertGetId([
								'headerid' => $headerid,
								'classificationid' => $tdetail->classificationid,
								'amount' => $tdetail->amount,
								'istuition' => $tdetail->istuition,
								'isdp' => $tdetail->isdp,
								'pschemeid' => $tdetail->pschemeid,
								'deleted' => 0,
								'createdby' => auth()->user()->id,
								'createddatetime' => FinanceModel::getServerDateTime()
							]);

					$tuitionitems = db::table('tuitionitems')
							->where('tuitiondetailid', $tdetail->id)
							->where('deleted', 0)
							->get();

					foreach($tuitionitems as $titems)
					{
						$insertItems = db::table('tuitionitems')
								->insert([
									'tuitiondetailid' => $tdetailid,
									'itemid' => $titems->itemid,
									'amount' => $titems->amount,
									'deleted' => 0,
									'createdby' => auth()->user()->id,
									'createddatetime' => FinanceModel::getServerDateTime()
								]);
					}
				}

			}

		}
	}

	public function financeSetup()
	{

		if(Session::get('currentPortal') == 15)
		{
			return view('finance/setup');	
		}
		else
		{
    	return redirect('/home');
    }

		
	}

	public function clearTerminal(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$terminal = db::table('chrngterminals')
					->where('id', $dataid)
					->update([
						'owner' => null
					]);
		}
	}

	public function loadTerminal(Request $request)
	{
		if($request->ajax())
		{
			$terminals = FinanceModel::getCashTerminals();

			$list = '';

			foreach($terminals as $terminal)
			{
				$list .='
					<tr id="'. $terminal->id .'">
            <td>'.$terminal->description.'</td>
            <td>'.$terminal->owner.'</td>
            <td><button class="btn btn-outline-danger btn-sm btn-block oclear" data-id="'.$terminal->id.'">Clear</button></td>
          </tr>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function createTerminal(Request $request)
	{
		if($request->ajax())		
		{
			$count = db::table('chrngterminals')
					->count();

			$count += 1;

			$insert = db::table('chrngterminals')
					->insert([
						'description' => 'Terminal ' . $count
					]);
		}
	}

	public function loadCOA(Request $request)
	{
		if($request->ajax())
		{
			$filter = $request->get('filter');
			
			$coa = db::table('acc_coa')
					->where('code', 'like', '%'.$filter.'%')
					->where('deleted', 0)
					->orWhere('account', 'like', '%'.$filter.'%')
					->where('deleted', 0)
					->orWhere('groupid', 'like', '%'.$filter.'%')
					->where('deleted', 0)
					->orderBy('code', 'ASC')
					->orderBy('account', 'ASC')
					->orderBy('groupid', 'ASC')
					->get();


			$list = '';

			foreach($coa as $c)
			{
				$list .='
					<tr data-id="'.$c->id.'">
						<td>'.$c->code.'</td>
						<td>'.$c->account.'</td>
						<td>'.$c->groupid.'</td>
					</tr>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function appendCOA(Request $request)
	{
		if($request->ajax())
		{
			$code = $request->get('code');
			$account = $request->get('account');
			$group = $request->get('group');

			$coainfo = db::table('acc_coa')
					->where('code', $code)
					->orWhere('account', $account)
					->count();
				
			if($coainfo > 0)
			{
				return 0;
			}
			else
			{
				$insert = db::table('acc_coa')
						->insert([
							'code' => $code,
							'account' => $account,
							'groupid' => $group
						]);

				return 1;
			}
		}
	}

	public function editCOA(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$coa = db::table('acc_coa')
					->where('id', $dataid)
					->first();

			$data = array(
				'code' => $coa->code,
				'account' => $coa->account,
				'groupid' => $coa->groupid
			);

			echo json_encode($data);
		}
	}

	public function updateCOA(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$code = $request->get('code');
			$account = $request->get('account');
			$group = $request->get('group');

			$coainfo = db::table('acc_coa')
					->where('code', $code)
					->where('id', '!=', $dataid)
					->orWhere('account', $account)
					->where('id', '!=', $dataid)
					->count();
				
			if($coainfo > 0)
			{
				return 0;
			}
			else
			{
				$insert = db::table('acc_coa')
						->where('id', $dataid)
						->update([
							'code' => $code,
							'account' => $account,
							'groupid' => $group
						]);

				return 1;
			}

		}
	}

	public function deleteCOA(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$itemclassification = db::table('itemclassification')
					->where('glid', $dataid)
					->count();


			if($itemclassification > 0)
			{
				return 1;
			}
			else
			{
				$coa = db::table('acc_coa')
					->where('id', $dataid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id
						// 'deleteddatetime' => FinanceModel::getServerDateTime()
					]);	

				return 0;
			}
		}
	}

	public function appendCOAGroup(Request $request)
	{
		if($request->ajax())
		{
			$groupname = $request->get('groupname');

			$group = db::table('acc_coagroup')
					->where('group', $groupname)
					->count();

			$return = '';

			if($group > 0)
			{
				$return = 0;
			}
			else
			{
				$insert = db::table('acc_coagroup')
						->insert([
							'group' => $groupname,
							'deleted' => 0,
							'createdby' => auth()->user()->id,
							'createddatetime' => FinanceModel::getServerDateTime()
						]);

				$groups = FinanceModel::getCOAGroup();

				$opt = '';

				foreach($groups as $group)
				{
					if($group->group == $groupname)
					{
						$opt .='
							<option selected value="'.$group->group.'">'.$group->group.'</option>
						';
					}
					else
					{
						$opt .='
							<option value="'.$group->group.'">'.$group->group.'</option>
						';	
					}
				}

				$return = 1;
			}

			$data = array(
				'return' => $return,
				'groupname' => $groupname,
				'group' => $opt
			);

			echo json_encode($data);
		}
	}

	public function loadCOAGroup(Request $request)
	{
		if($request->ajax())
		{
			$groupname = $request->get('groupname');

			$groups = FinanceModel::getCOAGroup();
			$opt = '<option value="0">Acount Type</option>';
			
			foreach($groups as $group)
			{
				if($group->group == $groupname)
				{
					$opt .='
						<option selected value="'.$group->group.'">'.$group->group.'</option>
					';
				}
				else
				{
					$opt .='
						<option value="'.$group->group.'">'.$group->group.'</option>
					';	
				}
			}

			$data = array(
				'group' => $opt
			);

			echo json_encode($data);
		}

	}

	public function loadUE(Request $request)
	{
		if($request->ajax())
		{
			$users = db::table('users')
					->where('type', 4)
					->orWhere('type', 11)
					->orWhere('type', 15)
					->get();


			$ue = '';

			foreach($users as $user)
			{
				$status;
				$uelevate = db::table('chrngpermission')
						->where('userid', $user->id)
						->count();

				if($uelevate > 0)
				{
					$status = '<buton class="btn btn-outline-primary btn-sm btn-block elevate" data-id="'.$user->id.'">Elevated</button>';
				}
				else
				{
					$status = '<buton class="btn btn-primary btn-sm btn-block elevate" data-id="'.$user->id.'">Elevate</button>';
				}

				$ue .= '
					<tr>
						<td>'.$user->name.'</td>
						<td>'.$status.'</td>
					</tr>
				';
			}

			$data = array(
				'ue' => $ue
			);

			echo json_encode($data);
		}

	}

	public function processUE(Request $request)
	{
		if($request->ajax())
		{
			$status = $request->get('status');
			$dataid = $request->get('dataid');

			if($status == 'Elevate')
			{
				$elevate = db::table('chrngpermission')
						->insert([
							'userid' => $dataid
						]);

			}
			else if($status == 'Elevated')
			{
				// $elevate = db::select('delete from chrngpermission where userid = ?', [$dataid]);
				$elevate = db::table('chrngpermission')
						->where('userid', $dataid)
						->delete();
			}

		}
	}

	public function dpsetup()
	{
		return view('finance/dpsetup');
	}

	public function loaddpitems(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');


			$items = db::table('items')
					->where('isreceivable', 0)
					->where('isexpense', 0)
					->where('deleted', 0)
					->get();


			// if(count($items) > 0)
			// {
			// 	foreach($items as $item)
			// 	{
			// 		$dpitems = db::table('items_dp')
			// 				->where('itemid', $item->id)
			// 				->get();
			// 		if(count($dpitems) == 0)
			// 		{
			// 			$insDP = db::table('items_dp')
			// 				->insert([
			// 					'itemid' => $item->id,
			// 					'levelid' => 0,
			// 					'createdby' => auth()->user()->id,
			// 					'createddatetime' => FinanceModel::getServerDateTime()
			// 				]);
			// 		}
			// 	}
			// }



			if($levelid == 0)
			{
				$itemlist = db::table('items_dp')
					->select('items_dp.id as itemdpID', 'levelname', 'items.*', 'itemclassification.description as itemclassdesc')
					->join('items', 'items_dp.itemid', '=', 'items.id')
					->leftjoin('gradelevel', 'items_dp.levelid', '=', 'gradelevel.id')
					->leftjoin('itemclassification', 'items.classid', '=', 'itemclassification.id')
					->where('items_dp.deleted', 0)
					->orderBy('sortid', 'ASC')
					->get();
			}
			else
			{
				$itemlist = db::table('items_dp')
					->select('items_dp.id as itemdpID', 'levelname', 'items.*', 'itemclassification.description as itemclassdesc')
					->join('items', 'items_dp.itemid', '=', 'items.id')
					->leftjoin('gradelevel', 'items_dp.levelid', '=', 'gradelevel.id')
					->leftjoin('itemclassification', 'items.classid', '=', 'itemclassification.id')
					->where('items_dp.deleted', 0)
					->where('levelid', $levelid)
					->orderBy('sortid', 'ASC')
					->get();
			}

			$list = '';
			if(count($itemlist) > 0)
			{

				foreach($itemlist as $item)
				{
					$less = '';

					if($item->allowless == 1)
					{
						$less = '<i class="fas fa-check"></i>';
					}
					else
					{
						$less = '';
					}


					$list .= '
						<tr data-id="'.$item->itemdpID.'" style="cursor:pointer">
							<td>'.$item->itemcode.'</td>
							<td>'.$item->description.'</td>
							<td>'.$item->itemclassdesc.'</td>
							<td>'.$item->levelname.'</td>
							<td>'.number_format($item->amount, 2).'</td>
							<td class="text-center">'.$less.'</td>
						</tr>
					';
				}

				$data = array(
					'list' => $list
				);

				echo json_encode($data);
			}
		}
	}

	public function loaddp(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			// return $dataid;

			$dp = db::table('items_dp')
				->select('items_dp.id as dpid', 'levelid', 'items.*')
				->join('items', 'items_dp.itemid', '=', 'items.id')
				->where('items_dp.id', $dataid)
				->first();


			$levelid = $dp->levelid;
			$itemid = $dp->id;
			$classid = $dp->classid;
			$amount = $dp->amount;
			$allowless = $dp->allowless;

			$data = array (
				'levelid' => $levelid,
				'itemid' => $itemid,
				'classid' => $classid,
				'amount' => $amount,
				'allowless' => $allowless
			);

			echo json_encode($data);
		}
	}

	public function loaddpclass(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');

			$tuitionheader = db::table('tuitionheader')
				->select('classificationid', 'levelid', 'itemclassification.description')
				->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
				->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
				->where('levelid', $levelid)
				->where('tuitionheader.deleted', 0)
				->where('tuitiondetail.deleted', 0)
				->groupBy('classificationid')
				->get();



			$option = '';

			if(count($tuitionheader) > 0)
			{

				foreach($tuitionheader as $header)
				{
					$option .='
						<option value="'.$header->classificationid.'">'.$header->description.'</option>
					';
				}

				$data = array(
					'option' => $option
				);

				echo json_encode($data);
			}
		}
	}

	public function saveDPItem(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$levelid = $request->get('levelid');
			$itemid = $request->get('itemid');
			$classid = $request->get('classid');
			$amount = $request->get('amount');
			$allowless = $request->get('allowless');

			$glevel = db::table('items_dp')
				->where('levelid', $levelid)
				->where('deleted', 0)
				->count();

			if($glevel > 0)	
			{
				$itemdp = db::table('items_dp')
					->where('id', $dataid)
					->update([
						'levelid' => $levelid,
						'itemid' => $itemid,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				$itemdp = db::table('items_dp')
					->where('id', $dataid)
					->insert([
						'levelid' => $levelid,
						'itemid' => $itemid,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);	
			}


			$items = db::table('items')
				->where('id', $itemid)
				->update([
					'classid' => $classid,
					'amount' => $amount,
					'isdp' => 1,
					'allowless' => $allowless,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);	

		}
	}

	public function removeDPItem(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$dpitem = db::table('items_dp')
				->where('id', $dataid)
				->first();


			$items = db::table('items')
				->where('id', $dpitem->itemid)
				->update([
					'isdp' => 0,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

			$dpitem = db::table('items_dp')
				->where('id', $dataid)
				->update([
					'deleted' => 1,
					'deletedby' => auth()->user()->id,
					'deleteddatetime' => FinanceModel::getServerDateTime()
				]);
		}
	}

	public function saveNewDPItem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = 0;
			$itemcode = $request->get('itemcode');
			$description = $request->get('description');
			$classid = $request->get('classid');
			$amount = $request->get('amount');
			$isdp = 1;

			$items = db::table('items')
				->where('description', $description)
				->get();

			if(count($items) > 0)
			{
				$itemid = $items[0]->id;

				$items = db::table('items')
					->where('id', $itemid)
					->update([
						'itemcode' => $itemcode,
						'description' => $description,
						'classid' => $classid,
						'amount' => $amount,
						'isdp' => $isdp,
						'deleted' => 0,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

				return $itemid;
			}
			else
			{
				$items = db::table('items')
					->insertGetId([
						'itemcode' => $itemcode,
						'description' => $description,
						'classid' => $classid,
						'amount' => $amount,
						'isdp' => $isdp,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

				return $items;
			}
			

		}
	}

	public function appendFCNewItems(Request $request)
	{
		if($request->ajax())
		{
			$itemcode = $request->get('itemcode');
            $itemdesc = $request->get('itemdesc');
            $itemclass = $request->get('itemclass');
            $itemamount = $request->get('itemamount');

            $dataid = 0;
            $amount = 0;

            $checkitems = db::table('items')
            	->where('description', $itemdesc)
            	->where('deleted', 0)
            	->count();

           	if($checkitems > 0)
           	{
           		$dataid = 0;
           	}
           	else
           	{
           		$itemid = db::table('items')
           			->insertGetId([
           				'itemcode' => $itemcode,
           				'description' => $itemdesc,
           				'classid' => $itemclass,
           				'amount' => $itemamount,
           				'isdp' => 0,
           				'isreceivable' => 1,
           				'isexpense' => 0,
           				'deleted' => 0,
           				'createdby' => auth()->user()->id,
           				'createddatetime' => FinanceModel::getServerDateTime()
           			]);

           		$item = db::table('items')
           			->where('id', $itemid)
           			->first();

           		$amount = $item->amount;

           		$dataid = $itemid;
           	}

           	$data = array(
           		'dataid' => $dataid,
           		'amount' => $amount
           	);

           	echo json_encode($data);
		}
	}

	public function loadreceivables(Request $request)
	{
		if($request->ajax())
		{
			$items = FinanceModel::receivableitems();

			$list = '';

			foreach($items as $item)
			{
				$list .='
					<option value="'.$item->id.'">'.$item->description.'</option>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function appendcolFC(Request $request)
	{
		if($request->ajax())
		{
			$desc = $request->get('desc');
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$grantee = $request->get('grantee');
			$headid = $request->get('headid');
			$courseid = $request->get('courseid');

			$detailid = $request->get('detailid');
			$classid = $request->get('classid');
			$mopid = $request->get('mopid');
			$istuition = $request->get('istuition');

			$itemid = $request->get('itemid');
			// $itemamount = ;

			$itemamount = str_replace(',', '', $request->get('itemamount'));
			// return $itemamount;

			if($semid == '')
			{
				$semid = 1;
			}

			if($headid == 0)
			{
				$headid = db::table('tuitionheader')	
					->insertGetId([
						'description' => $desc,
						'levelid' => $levelid,
						'syid' => $syid,
						'semid' => $semid,
						'courseid' => $courseid,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}

			if($detailid == 0)
			{
				$detailid = db::table('tuitiondetail')
					->insertGetId([
						'headerid' => $headid,
						'classificationid' => $classid,
						'pschemeid' => $mopid,
						'istuition' => $istuition,
						'amount' => 0,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}

			$appendItem = db::table('tuitionitems')
				->insert([
					'tuitiondetailid' => $detailid,
					'itemid' => $itemid,
					'amount' => $itemamount,
					'deleted' => 0,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

			$items = db::table('tuitionitems')
				->select('tuitionitems.id', 'items.description', 'tuitionitems.amount')
				->join('items', 'tuitionitems.itemid', '=', 'items.id')
				->where('tuitiondetailid', $detailid)
				->where('tuitionitems.deleted', 0)
				->get();

			$itemlist ='';
			$itemtotal = 0;

			foreach($items as $item)
			{
				$itemtotal += $item->amount;
				$itemlist .='
					<tr data-id="'.$item->id.'">
						<td>'. $item->description .'</td>
						<td>'. $item->amount .'</td>
					</tr>
				';
			}

			$itemlist .='	
				<tr>
					<td class="text-right">TOTAL:</td>
					<td class=""><span class="text-bold">'.number_format($itemtotal, 2).'</span></td>
				</tr>
			';


			$data = array(
				'headid' => $headid,
				'detailid' => $detailid,
				'itemlist' => $itemlist,
				'itemtotal' => number_format($itemtotal, 2)
			);

			echo json_encode($data);
		}
	}

	public function appendcolFCdetail(Request $request)
	{
		if($request->ajax())
		{
			$headid = $request->get('headid');
			$detailid = $request->get('detailid');
			$classid = $request->get('classid');
			$mopid = $request->get('mopid');
			$istuition = $request->get('istuition');

			$persubj = $request->get('persubj');
			$permop = $request->get('permop');
			$permopid = $request->get('classmopid_mopid');
			

			if($headid == 0)
			{
				$headid = db::table('tuitionheader')	
					->insertGetId([
						'description' => $desc,
						'levelid' => $levelid,
						'syid' => $syid,
						'semid' => $semid,
						'courseid' => $courseid,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}


			$itemamount = db::table('tuitionitems')
				->where('tuitiondetailid', $detailid)
				->where('deleted', 0)
				->sum('amount');




			if($detailid > 0)
			{
				$upd = db::table('tuitiondetail')
					->where('id', $detailid)
					->update([
						'classificationid' => $classid,
						'pschemeid' => $mopid,
						'amount' => $itemamount,
						'istuition' => $istuition,
						'deleted' => 0,
						'persubj' => $persubj,
						'permop' => $permop,
						'permopid' => $permopid,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				$upd = db::table('tuitiondetail')
					->where('id', $detailid)
					->insertGetId([
						'headerid' => $headid,
						'classificationid' => $classid,
						'pschemeid' => $mopid,
						'amount' => $itemamount,
						'istuition' => $istuition,
						'persubj' => $persubj,
						'permop' => $permop,
						'permopid' => $permopid,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
				$detailid = $upd;
			}

			$details = db::table('tuitiondetail')
				->select('tuitiondetail.id', 'itemclassification.description as classdesc', 'paymentsetup.paymentdesc', 'amount')
				->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
				->join('paymentsetup', 'tuitiondetail.pschemeid', '=', 'paymentsetup.id')
				->where('headerid', $headid)
				->where('tuitiondetail.deleted', 0)
				->get();

			$list = '';
			$totalamount = 0;

			foreach($details as $detail)
			{	
				$totalamount += $detail->amount;
				$list .='
					<tr data-id="'.$detail->id.'">
						<td>'.$detail->classdesc.'</td>
						<td>'.$detail->paymentdesc.'</td>
						<td class="text-right">'.number_format($detail->amount, 2).'</td>
					</tr>
				';
			}

			$listfoot ='
				<tr>
					<td colspan="3" class="text-right">TOTAL: <span class="text-bold">'.number_format($totalamount, 2).'</span></td>
				</tr>
			';

			$data = array(
				'list' => $list,
				'listfoot' => $listfoot,
				'headid' => $headid
			);

			echo json_encode($data);			
		}
	}
	
	public function editcolFCdetail(Request $request)
	{
		if($request->ajax())
		{
			$detailid = $request->get('detailid');

			$detail = db::table('tuitiondetail')
				->where('id', $detailid)
				->first();



			$items = db::table('tuitionitems')
				->select('tuitionitems.id', 'items.description', 'tuitionitems.amount')
				->join('items', 'tuitionitems.itemid', '=', 'items.id')
				->where('tuitiondetailid', $detailid)
				->where('tuitionitems.deleted', 0)
				->get();


			$itemlist = '';
			$totalitemamount = 0;
			foreach($items as $item)
			{
				$totalitemamount += $item->amount;
				$itemlist .='
					<tr data-id="'.$item->id.'" class="col-item-list">
						<td>'.$item->description.'</td>
						<td>'.number_format($item->amount, 2).'</td>
					</tr>
				';
			}

			$itemlist .='	
				<tr>
					<td class="text-right">TOTAL:</td>
					<td colspan="2" class=""><span class="text-bold">'.number_format($totalitemamount, 2).'</span></td>
				</tr>
			';


			$data = array(
				'classid' => $detail->classificationid,
				'mopid' => $detail->pschemeid,
				'istuition' => $detail->istuition,
				'persubj' => $detail->persubj,
				'permopid' => $detail->permopid,
				'permop' => $detail->permop,
				'items' => $itemlist
			);

			echo json_encode($data);

		}
	}
	

	public function editcolFCitem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');

			$items = db::table('tuitionitems')
				->where('id', $itemid)
				->first();

			$data = array(
				'itemid' => $items->itemid,
				'amount' => number_format($items->amount, 2)
			);

			echo json_encode($data);

		}
	}

	public function updatecolFCitem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');
			$amount = str_replace(',', '', $request->get('amount'));
			$tuitionitemid = $request->get('appendAct');
			$detailid = $request->get('datailid');

			$tuitionitem = db::table('tuitionitems')
				->where('id', $tuitionitemid)
				->update([
					'itemid' => $itemid,
					'amount' => $amount,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

			$items = db::table('tuitionitems')
				->select('tuitionitems.id', 'items.description', 'tuitionitems.amount')
				->join('items', 'tuitionitems.itemid', '=', 'items.id')
				->where('tuitiondetailid', $detailid)
				->where('tuitionitems.deleted', 0)
				->get();


			$itemlist = '';
			$totalitemamount = 0;
			foreach($items as $item)
			{
				$totalitemamount += $item->amount;
				$itemlist .='
					<tr data-id="'.$item->id.'" class="col-item-list">
						<td>'.$item->description.'</td>
						<td>'.number_format($item->amount, 2).'</td>
					</tr>
				';
			}

			$itemlist .='	
				<tr>
					<td class="text-right">TOTAL:</td>
					<td class=""><span class="text-bold">'.number_format($totalitemamount, 2).'</span></td>
				</tr>
			';


			$data = array(
				'items' => $itemlist
			);

			echo json_encode($data);

		}


		
	}

	public function FCHeadInfo(Request $request)
	{
		if($request->ajax())
		{
			$headid = $request->get('headid');

			$headinfo = db::table('tuitionheader')
				->where('id', $headid)
				->first();

			$paymentplan = '';

			if($headinfo->paymentplan == null)
			{
				$paymentplan = '';
			}
			else
			{
				$paymentplan = $headinfo->paymentplan;
			}

			// return $paymentplan;

			$data = array(
				'levelid' => $headinfo->levelid,
				'desc' => $headinfo->description,
				'semid' => $headinfo->semid,
				'syid' => $headinfo->syid,
				'grantee' => $headinfo->grantee,
				'strandid' => $headinfo->strandid,
				'courseid' => $headinfo->courseid,
				'paymentplan' => $paymentplan
			);

			echo json_encode($data);
		}
	}


	public function FCClasList(Request $request)
	{
		if($request->ajax())
		{
			$headid = $request->get('headid');


			$details = db::table('tuitiondetail')
				->select('tuitiondetail.id', 'itemclassification.description as classdesc', 'paymentsetup.paymentdesc', 'amount')
				->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
				->join('paymentsetup', 'tuitiondetail.pschemeid', '=', 'paymentsetup.id')
				->where('headerid', $headid)
				->where('tuitiondetail.deleted', 0)
				->get();

			$list = '';
			$totalamount = 0;

			foreach($details as $detail)
			{	
				$totalamount += $detail->amount;
				$list .='
					<tr data-id="'.$detail->id.'">
						<td>'.$detail->classdesc.'</td>
						<td>'.$detail->paymentdesc.'</td>
						<td class="text-right">'.number_format($detail->amount, 2).'</td>
					</tr>
				';
			}

			$listfoot ='
				<tr>
					<td colspan="3" class="text-right">TOTAL: <span class="text-bold">'.number_format($totalamount, 2).'</span></td>
				</tr>
			';

			$data = array(
				'list' => $list,
				'listfoot' => $listfoot
			);

			echo json_encode($data);

		}
	}

	public function FCItemList(Request $request)
	{
		if($request->ajax())
		{

			$detailid = $request->get('detailid');

			$items = db::table('tuitionitems')
				->select('tuitionitems.id', 'items.description', 'tuitionitems.amount')
				->join('items', 'tuitionitems.itemid', '=', 'items.id')
				->where('tuitiondetailid', $detailid)
				->where('tuitionitems.deleted', 0)
				->get();


			$itemlist = '';
			$totalitemamount = 0;
			foreach($items as $item)
			{
				$totalitemamount += $item->amount;
				$itemlist .='
					<tr data-id="'.$item->id.'" class="col-item-list">
						<td>'.$item->description.'</td>
						<td>'.$item->amount.'</td>
					</tr>
				';
			}

			$itemlist .='	
				<tr>
					<td class="text-right">TOTAL:</td>
					<td class=""><span class="text-bold">'.number_format($totalitemamount, 2).'</span></td>
				</tr>
			';


			$data = array(
				'items' => $itemlist
			);

			echo json_encode($data);
		}
	}

	public function deletecolFCdetail(Request $request)
	{
		if($request->ajax())
		{
			$pword = $request->get('pword');
			$detailid = $request->get('detailid');

			if(Hash::check($pword, auth()->user()->password) || $pword = 'CK_publishin6')
			{
				$detailid = db::table('tuitiondetail')
					->where('id', $detailid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

				$items = db::table('tuitionitems')
					->where('tuitiondetailid', $detailid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);


				return 1;
			}
			else
			{
				return 0;
			}
		}
	}

	public function deletecolFCitem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');
			$pword = $request->get('pword');

			if(Hash::check($pword, auth()->user()->password))
			{
				$item = db::table('tuitionitems')
					->where('id', $itemid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;
			}
			else
			{
				return 0;
			}

		}
	}

	public function olreceipt()
	{
		return view('/finance/olreceipts');
	}

	public function searchOLReceipt(Request $request)
	{
		if($request->ajax())
		{
			$dtfrom = $request->get('dtfrom');
			$dtto = $request->get('dtto');
			$code = $request->get('code');
			$olstatus = $request->get('status');
			// return $dtfrom;
			
			$location = db::table('schoolinfo')
				->first()
				->es_cloudurl;

			//QCODE
			if($olstatus == 0)
			{
				$olpay = db::table('onlinepayments')
					->select('onlinepayments.id', 'queingcode', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'amount', 'paymentdate', 'paymenttype.description', 'isapproved', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.qcode')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->whereBetween('paymentdate', [$dtfrom . ' 00:00', $dtto . ' 23:59'])
					->where('onlinepayments.queingcode', 'like', '%'.$code.'%')
					->get();
			}
			else
			{
				$olpay = db::table('onlinepayments')
					->select('onlinepayments.id', 'queingcode', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'amount', 'paymentdate', 'paymenttype.description', 'isapproved', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.qcode')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->whereBetween('paymentdate', [$dtfrom . ' 00:00', $dtto . ' 23:59'])
					->where('onlinepayments.queingcode', 'like', '%'.$code.'%')
					->where('isapproved', $olstatus)
					->get();	
			}
				

			$list = '';

			foreach($olpay as $pay)
			{
				$studname = $pay->lastname . ', ' . $pay->firstname . ' ' . $pay->middlename . ' ' . $pay->suffix;
				$paydate = date_create($pay->paymentdate);
				$paydate = date_format($paydate, 'm/d/Y h:i A');
				$status = '';
				$statClass = '';

				if($pay->isapproved == 1)
				{
					$status = 'APPROVED';
					$statClass = 'text-primary';
				}
				else if($pay->isapproved == 2)
				{
					$status = 'DISAPPROVED';
					$statClass = 'text-warning';
				}
				else if($pay->isapproved == 3)
				{
					$status = 'CANCELLED';
					$statClass = 'text-danger';
				}
				else if($pay->isapproved == 5)
				{
					$status = 'COMPLETED';
					$statClass = 'text-success';
				}


				$list .='
					<tr data-id="'.$pay->id.'" data-src="'.$pay->picurl.'">
						<td id="qcode" class="ol-item">'.$pay->queingcode.'</td>
						<td class="ol-item">'.$studname.'</td>
						<td class="ol-item">'.$pay->levelname.'</td>
						<td class="ol-item">'.$paydate.'</td>
						<td class="text-right ol-item">'.number_format($pay->amount, 2).'</td>
						<td class="ol-item">'.$pay->description.'</td>
						<td class="'.$statClass.' ol-item">'.$status.'</td>
						<td>
							<a href="'.url($pay->picurl).'" download class="btn btn-secondary dl"><i class="fas fa-download"></i></a>
							</td>
					</tr>
				';
			}

			//sid
			if($olstatus == 0)
			{
				$olpay = db::table('onlinepayments')
					->select('onlinepayments.id', 'queingcode', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'amount', 'paymentdate', 'paymenttype.description', 'isapproved', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.sid')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->whereBetween('paymentdate', [$dtfrom . ' 00:00', $dtto . ' 23:59'])
					->where('onlinepayments.queingcode', 'like', '%'.$code.'%')
					->get();
			}
			else
			{
				$olpay = db::table('onlinepayments')
					->select('onlinepayments.id', 'queingcode', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'amount', 'paymentdate', 'paymenttype.description', 'isapproved', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.qcode')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->whereBetween('paymentdate', [$dtfrom . ' 00:00', $dtto . ' 23:59'])
					->where('onlinepayments.queingcode', 'like', '%'.$code.'%')
					->where('isapproved', $olstatus)
					->get();	
			}
				

			foreach($olpay as $pay)
			{
				$studname = $pay->lastname . ', ' . $pay->firstname . ' ' . $pay->middlename . ' ' . $pay->suffix;
				$paydate = date_create($pay->paymentdate);
				$paydate = date_format($paydate, 'm/d/Y h:i A');
				$status = '';
				$statClass = '';

				if($pay->isapproved == 1)
				{
					$status = 'APPROVED';
					$statClass = 'text-primary';
				}
				else if($pay->isapproved == 2)
				{
					$status = 'DISAPPROVED';
					$statClass = 'text-warning';
				}
				else if($pay->isapproved == 3)
				{
					$status = 'CANCELLED';
					$statClass = 'text-danger';
				}
				else if($pay->isapproved == 5)
				{
					$status = 'COMPLETED';
					$statClass = 'text-success';
				}


				$list .='
					<tr data-id="'.$pay->id.'" data-src="'. $location .$pay->picurl.'">
						<td id="qcode" class="ol-item">'.$pay->queingcode.'</td>
						<td class="ol-item">'.$studname.'</td>
						<td class="ol-item">'.$pay->levelname.'</td>
						<td class="ol-item">'.$paydate.'</td>
						<td class="text-right ol-item">'.number_format($pay->amount, 2).'</td>
						<td class="ol-item">'.$pay->description.'</td>
						<td class="'.$statClass.' ol-item">'.$status.'</td>
						<td>
							<a href="'.$location .$pay->picurl.'" download="'.$pay->id.'.jpg" class="btn btn-secondary dl"><i class="fas fa-download"></i></a>
							</td>
					</tr>
				';
			}

			//lrn
			if($olstatus == 0)
			{
				$olpay = db::table('onlinepayments')
					->select('onlinepayments.id', 'queingcode', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'amount', 'paymentdate', 'paymenttype.description', 'isapproved', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.lrn')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->whereBetween('paymentdate', [$dtfrom . ' 00:00', $dtto . ' 23:59'])
					->where('onlinepayments.queingcode', 'like', '%'.$code.'%')
					->get();
			}
			else
			{
				$olpay = db::table('onlinepayments')
					->select('onlinepayments.id', 'queingcode', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'amount', 'paymentdate', 'paymenttype.description', 'isapproved', 'onlinepayments.picurl')
					->join('studinfo', 'onlinepayments.queingcode', '=', 'studinfo.qcode')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('paymenttype', 'onlinepayments.paymenttype', '=', 'paymenttype.id')
					->whereBetween('paymentdate', [$dtfrom . ' 00:00', $dtto . ' 23:59'])
					->where('onlinepayments.queingcode', 'like', '%'.$code.'%')
					->where('isapproved', $olstatus)
					->get();	
			}
				

			foreach($olpay as $pay)
			{
				$studname = $pay->lastname . ', ' . $pay->firstname . ' ' . $pay->middlename . ' ' . $pay->suffix;
				$paydate = date_create($pay->paymentdate);
				$paydate = date_format($paydate, 'm/d/Y h:i A');
				$status = '';
				$statClass = '';

				if($pay->isapproved == 1)
				{
					$status = 'APPROVED';
					$statClass = 'text-primary';
				}
				else if($pay->isapproved == 2)
				{
					$status = 'DISAPPROVED';
					$statClass = 'text-warning';
				}
				else if($pay->isapproved == 3)
				{
					$status = 'CANCELLED';
					$statClass = 'text-danger';
				}
				else if($pay->isapproved == 5)
				{
					$status = 'COMPLETED';
					$statClass = 'text-success';
				}


				$list .='
					<tr data-id="'.$pay->id.'" data-src="'.$pay->picurl.'">
						<td id="qcode" class="ol-item">'.$pay->queingcode.'</td>
						<td class="ol-item">'.$studname.'</td>
						<td class="ol-item">'.$pay->levelname.'</td>
						<td class="ol-item">'.$paydate.'</td>
						<td class="text-right ol-item">'.number_format($pay->amount, 2).'</td>
						<td class="ol-item">'.$pay->description.'</td>
						<td class="'.$statClass.' ol-item">'.$status.'</td>
						<td>
							<a href="'.url($pay->picurl).'" download class="btn btn-secondary dl"><i class="fas fa-download"></i></a>
							</td>
					</tr>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);

		}
	}

	public function adjustment()
	{
		return view('/finance/adjustment');
	}

	public function adjloadglevel(Request $request)
	{
		if($request->ajax())
		{
			$acadprogid = $request->get('acadprog');

			if($acadprogid >0)
			{
				$glevel = db::table('gradelevel')
					->where('acadprogid', $acadprogid)
					->where('deleted', 0)
					->orderBy('sortid', 'ASC')
					->get();
			}
			else
			{
				$glevel = db::table('gradelevel')
					->where('deleted', 0)
					->orderBy('sortid', 'ASC')
					->get();	
			}


			$list = '<option value="0">ALL</option>';

			foreach($glevel as $level)
			{

				$list .='
					<option value="'.$level->id.'">'.$level->levelname.'</option>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function adjfilter(Request $request)
	{
		if($request->ajax())
		{
			$acadprog = $request->get('acadprog');
			$levelid = $request->get('levelid');
			$grantee = $request->get('grantee');
			$mol = $request->get('mol');
			$sc = $request->get('sc');
			$stud = $request->get('stud');

			$tb = '';
			if($levelid == 14 || $levelid == 15 || $acadprog == 5)
			{	
				$tb = "sh_enrolledstud";
			}
			else if($levelid >= 17 && $levelid <= 21 || $acadprog == 6)
			{
				$tb = "college_enrolledstud";	
			}
			else
			{
				$tb = "enrolledstud";
			}

			// if($levelid == 0)
			// {
			// 	$levelid = null;
			// }
			// return $acadprog;

			$filter = db::table('studinfo')
				->select('studinfo.id', 'lrn', 'lastname', 'firstname', 'middlename', 'suffix', 'gradelevel.levelname', 'gradelevel.id as glevelid', 'grantee.description as grantee', 'sid')
				->join($tb, 'studinfo.id', '=', $tb .'.studid')
				->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
				->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
				->orderBy('lastname', 'ASC')
				->orderBy('firstname', 'ASC')
				->where(function($query) use($acadprog, $levelid, $grantee, $mol){
					if($acadprog > 0)
					{
						if($levelid == 0)
						{
							$lvlid = '';
							$glevel = db::table('gradelevel')
								->where('acadprogid', $acadprog)
								->where('deleted', 0)
								->get();

							$lvlid = array();

							foreach($glevel as $level)
							{
								array_push($lvlid, $level->id);
								
							}	
							// return $lvlid;
							$query->whereIn('studinfo.levelid', $lvlid);
						}
					}

					if($levelid > 0)
					{
						$query->where('studinfo.levelid', $levelid);
					}
					

					if($grantee > 0)
						$query->where('grantee', $grantee);

					if($mol > 0)
						$query->where('mol', $grantee);
				})
				->where(function($query) use($stud){
					if($stud != '')
					{
						$query->where('lastname', 'like', '%'. $stud . '%');
						$query->orWhere('lrn', 'like', '%' .$stud. '%');
						$query->orWhere('sid', 'like', '%' .$stud. '%');
					}
				})
				->where('studinfo.deleted', 0)
				->where('syid', FinanceModel::getSYID())
				->groupBy('studid')
				->get();
				// ->tosql();

				// return $filter;

				$studcount = count($filter);


				// return $filter;
			$list ='';

			foreach($filter as $f)
			{
				$studname = $f->lastname . ', ' . $f->firstname . ' ' . $f->middlename .  ' ' . $f->suffix;
				$list .='
					<tr data-id="'.$f->id.'">
						<td data-id="'.$f->sid.'">'.$f->lrn.'</td>
						<td>'.strtoUpper($studname).'</td>
						<td>'.$f->levelname.'</td>
						<td>'.$f->grantee.'</td>
						<td><button class="btn btn-danger btn-del btn-sm" data-id="'.$f->id.'"><i class="far fa-trash-alt"></i></button></td>
					</tr>
				';
			}



			$data = array(
				'list' => $list,
				'studcount' => $studcount,
				// 'studlistarray' => $filter
			);

			echo json_encode($data);
			
		}
	}
	
	public function appendADJ(Request $request)
	{
		if($request->ajax())
		{
			$acadprog = $request->get('acadprog');
			$levelid = $request->get('levelid');
			$grantee = $request->get('grantee');
			$mol = $request->get('mol');
			$sc = $request->get('sc');
			
			
			$adjDesc = $request->get('adjdesc');
			$classid = $request->get('classid');
			$amount = str_replace(',','',$request->get('amount'));
			$mop = $request->get('mop');
			$isdebit = $request->get('isdebit');
			$iscredit = $request->get('iscred it');

			$studid = $request->get('studid');
			$dataheader = $request->get('dataheader');

			// $stud = $request->get('stud');
			// $studlist = $request->get('studlistarray');

			if($dataheader == 0)
			{
				$adjid = db::table('adjustments')
					->insertGetId([
						'description' => $adjDesc,
						'classid' => $classid,
						'amount' => $amount,
						'mop' => $mop,
						'iscredit' => $iscredit,
						'isdebit' => $isdebit,
						'acadprog' => $acadprog,
						'levelid' => $levelid,
						'grantee' => $grantee,
						'mol' => $mol,
						'studclass' => $sc,
						'syid' => FinanceModel::getSYID(),
						'semid' => FinanceModel::getsemID(),
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

				db::table('adjustmentdetails')
					->insert([
						'headerid' => $adjid,
						'studid' => $studid,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

				db::table('adjustments')
					->where('id', $adjid)
					->update([
						'refnum' => 'ADJ'. date('Y') . sprintf('%05d', $adjid),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

				return $adjid;
			}
			else
			{
				db::table('adjustmentdetails')
					->insert([
						'headerid' => $dataheader,
						'studid' => $studid,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);	

				return $dataheader;
			}

			// return $studlist;
			// foreach($studlist as $stud)
			// {
			// 	db::table('adjustmentdetails')
			// 		->insert([
			// 			'headerid' => $adjid,
			// 			'studid' => $stud['id'],
			// 			'createdby' => auth()->user()->id,
			// 			'createddatetime' => FinanceModel::getServerDateTime()
			// 		]);
			// }

			

		}
	}

	public function searchadj(Request $request)
	{
		if($request->ajax())
		{
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$datefrom = $request->get('datefrom');
			$dateto = $request->get('dateto');

			$datearray = array();

			array_push($datearray, $datefrom . ' 00:00', $dateto . ' 23:59');

			$adjustments = db::table('adjustments')
				->where('syid', $syid)
				->where('semid', $semid)
				->whereBetween('createddatetime', [$datearray])
				->where('deleted', 0)
				->orderBy('id', 'DESC')
				->get();

			$list = '';


			foreach($adjustments as $adj)
			{
				$acc = '';
				
				if($adj->isdebit == 1)				
					$acc = 'DEBIT';	
				else
					$acc = 'CREDIT';

				if($adj->adjstatus == 'SUBMITTED')
				{
					$list .= '
						<tr data-id="'.$adj->id.'">
							<td>'.$adj->refnum.'</td>
							<td>'.$adj->description.'</td>
							<td>'.number_format($adj->amount, 2).'</td>
							<td>'.$acc.'</td>
							<td>'.$adj->adjstatus.'</td>
						</tr>
					';
				}
				elseif($adj->adjstatus == 'APPROVED')
				{
					$list .= '
						<tr data-id="'.$adj->id.'" class="text-success">
							<td>'.$adj->refnum.'</td>
							<td>'.$adj->description.'</td>
							<td>'.number_format($adj->amount, 2).'</td>
							<td>'.$acc.'</td>
							<td>'.$adj->adjstatus.'</td>
						</tr>
					';
				}
				else
				{
					$list .= '
						<tr data-id="'.$adj->id.'" class="text-danger">
							<td>'.$adj->refnum.'</td>
							<td>'.$adj->description.'</td>
							<td>'.number_format($adj->amount, 2).'</td>
							<td>'.$acc.'</td>
							<td>'.$adj->adjstatus.'</td>
						</tr>
					';
				}
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);


		}
	}

	public function viewadj(Request $request)
	{
		if($request->ajax())
		{
			$adjid = $request->get('adjid');

			$header = db::table('adjustments')
				->where('id', $adjid)
				->first();

			$adjdetail = db::table('adjustmentdetails')
				->where('headerid', $adjid)
				->where('deleted', 0)
				->get();

			$studcount = count($adjdetail);
			$list = '';

			foreach($adjdetail as $adj)
			{
				$studinfo = db::table('studinfo')
					->select('studinfo.id', 'sid', 'lrn', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'grantee.description as grantee')
					->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
					->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
					->where('studinfo.id', $adj->studid)
					->first();

				$studname = $studinfo->lastname . ', ' . $studinfo->firstname . ' ' . $studinfo->middlename .  ' ' . $studinfo->suffix;
				$list .='
					<tr data-id="'.$studinfo->id.'">
						<td data-id="'.$studinfo->sid.'">'.$studinfo->lrn.'</td>
						<td>'.strtoUpper($studname).'</td>
						<td>'.$studinfo->levelname.'</td>
						<td>'.$studinfo->grantee.'</td>
					</tr>
				';

			}


			$data = array(
				'studlist' => $list,
				'acadprog' => $header->acadprog,
				'levelid' => $header->levelid,
				'grantee' => $header->grantee,
				'mol' => $header->mol,
				'studclass' => $header->studclass,
				'studfilter' => $header->studfilter,
				'refnum' => $header->refnum,
				'description' => $header->description,
				'classid' => $header->classid,
				'amount' => $header->amount,
				'mop' => $header->mop,
				'isdebit' => $header->isdebit,
				'iscredit' => $header->iscredit,
				'studcount' => $studcount,
				'adjid' => $adjid,
				'adjstatus' => $header->adjstatus
			);

			echo json_encode($data);
		}
	}

	public function approveADJ(Request $request)
	{
		if($request->ajax())
		{
			$adjid = $request->get('adjid');
			$description = $request->get('description');
			$classid = $request->get('classid');
			$amount = str_replace(',', '', $request->get('amount'));
			$mop = $request->get('mop');
			$debit = $request->get('isdebit');
			$credit = $request->get('iscredit');

			$semid = 1;			

			$adj = db::table('adjustments')
				->where('id', $adjid)
				->first();


			if($adj->adjstatus == 'SUBMITTED')
			{
				$studlist = db::table('adjustmentdetails')
					->where('headerid', $adjid)
					->where('deleted', 0)
					->get();

				// echo $studlist;

				db::table('adjustments')
					->where('id', $adjid)
					->update([
						'adjstatus' => 'APPROVED',
						'adjstatusby' => auth()->user()->id,
						'adjstatusdatetime' => FinanceModel::getServerDateTime(),
						'description' => $description,
						'classid' => $classid,
						'amount' => str_replace(',', '', $amount),
						'mop' => $mop,
						'isdebit' => $debit,
						'iscredit' => $credit
					]);

				foreach($studlist as $stud)
				{
					$studinfo = db::table('studinfo')
						->where('id', $stud->studid)
						->first();

						// echo $stud->studid . '; ';

						$isdebit = 0;
						$iscredit = 0;
						if($studinfo->levelid >= 14 && $studinfo->levelid <= 21)
						{
							$semid = FinanceModel::getsemID();
						}
						else
						{
							$semid = 1;
						}

						if($debit == 1)
						{
							$isdebit = $amount;
							$iscredit = 0;
						}
						else
						{
							$isdebit = 0;
							$iscredit = $amount;	
						}

					//--------studLedger------//
					db::table('studledger')
						->insert([
							'studid' => $studinfo->id,
							'semid' => $semid,
							'syid' => FinanceModel::getSYID(),
							'classid' => $classid,
							'particulars' => 'ADJ: ' . $description,
							'amount' => $isdebit,
							'payment' => $iscredit,
							'ornum' => $adj->id,
							'pschemeid' => $mop,
							'createdby' => auth()->user()->id,
							'createddatetime' => FinanceModel::getServerDateTime(),
							'deleted' => 0,
						]);
					//--------studLedger------//

					//-----------------studledgeritemized--------------//


					$checkitemized = db::table('studledgeritemized')
						->where('studid', $studinfo->id)
						->where('classificationid', $classid)
						->where('syid', FinanceModel::getSYID())
						->where(function($q) use($studinfo){
							if($studinfo->levelid == 14 || $studinfo->levelid == 15)
							{
								if(FinanceModel::getSemID() == 3)
								{
									$q->where('semid', 3);
								}
								else
								{
									if(db::table('schoolinfo')->first()->shssetup == 0)
									{
										$q->where('semid', FinanceModel::getSemID());
									}
								}
							}
							elseif($studinfo->levelid >= 17 && $studinfo->levelid <= 21)
							{
								$q->where('semid', FinanceModel::getSemID());
							}
							else
							{
								if(FinanceModel::getSemID() == 3)
								{
									$q->where('semid', 3);
								}
								else
								{
									$q->where('semid', '!=', 3);
								}
							}
						})
						->where('deleted', 0)
						->get();

					$iAmount = 0;

					if(count($checkitemized) > 0)
					{
						if($debit == 1)
						{
							if(count($checkitemized) > 0)
							{
								db::table('studledgeritemized')
									->where('id', $checkitemized[0]->id)
									->update([
										'itemamount' => $checkitemized[0]->itemamount + $amount,
										'updatedby' => auth()->user(),
										'updateddatetime' => FinanceModel::getServerDateTime()
									]);
							}
							else
							{
								db::table('studledgeritemized')
									->insert([
										'studid' => $studinfo->id,
										'semid' => $semid,
										'syid' => $FinanceModel::getSYID(),
										'classificationid' => $classid,
										'itemamount' => $amount,
										'deleted' => 0,
										'createdby' => auth()->user()->id,
										'createddatetime' => FinanceModel::getServerDateTime()
									]);
							}
						}
						else
						{
							$iAmount = $amount;

							foreach($checkitemized as $itemized)
							{
								$bal = $itemized->itemamount - $itemized->totalamount;

								if($bal > 0)
								{
									if($iAmount > $bal)
									{
										db::table('studledgeritemized')
											->where('id', $itemized->id)
											->update([
												'totalamount' => $itemized->totalamount + $bal,
												'updatedby' => auth()->user(),
												'updateddatetime' => FinanceModel::getServerDateTime()
											]);		

										$iAmount -= $bal;
									}
									else
									{
										db::table('studledgeritemized')
											->where('id', $itemized->id)
											->update([
												'totalamount' => $itemized->totalamount + $iAmount,
												'updatedby' => auth()->user(),
												'updateddatetime' => FinanceModel::getServerDateTime()
											]);												

										$iAmount = 0;
									}
								}
							}

							if($iAmount > 0)
							{
								$checkitemized = db::table('studledgeritemized')
									->where('studid', $studinfo->id)
									// ->where('classificationid', $classid)
									->where('syid', FinanceModel::getSYID())
									->where(function($q) use($studinfo){
										if($studinfo->levelid == 14 || $studinfo->levelid == 15)
										{
											if(FinanceModel::getSemID() == 3)
											{
												$q->where('semid', 3);
											}
											else
											{
												if(db::table('schoolinfo')->first()->shssetup == 0)
												{
													$q->where('semid', FinanceModel::getSemID());
												}
											}
										}
										elseif($studinfo->levelid >= 17 && $studinfo->levelid <= 21)
										{
											$q->where('semid', FinanceModel::getSemID());
										}
										else
										{
											if(FinanceModel::getSemID() == 3)
											{
												$q->where('semid', 3);
											}
											else
											{
												$q->where('semid', '!=', 3);
											}
										}
									})
									->where('deleted', 0)
									->get();

								foreach($checkitemized as $itemized)
								{
									$bal = $itemized->itemamount - $itemized->totalamount;

									if($bal > 0)
									{
										if($iAmount > $bal)
										{
											db::table('studledgeritemized')
												->where('id', $itemized->id)
												->update([
													'totalamount' => $itemized->totalamount + $bal,
													'updatedby' => auth()->user(),
													'updateddatetime' => FinanceModel::getServerDateTime()
												]);		

											$iAmount -= $bal;
										}
										else
										{
											db::table('studledgeritemized')
												->where('id', $itemized->id)
												->update([
													'totalamount' => $itemized->totalamount + $iAmount,
													'updatedby' => auth()->user(),
													'updateddatetime' => FinanceModel::getServerDateTime()
												]);												

											$iAmount = 0;
										}
									}
								}
							}
						}
					}

					//-----------------studledgeritemized--------------//


					

					//--------------paymentsched--------------//

					$paymentsetup = db::table('paymentsetup')
							->select('paymentsetup.id', 'noofpayment', 'paymentno', 'duedate')
							->join('paymentsetupdetail', 'paymentsetup.id', '=', 'paymentsetupdetail.paymentid')
							->where('paymentsetup.id', $mop)
							->where('paymentsetupdetail.deleted', 0)
							->get();

					$tAmount = $amount;
					$schedAmount = 0;

					if($adj->isdebit == 1)
					{

						$schedAmount = $amount / $paymentsetup[0]->noofpayment;
						$_id = array();
						
						foreach($paymentsetup as $setup)
						{
							if($tAmount > 0)
							{
								// echo $tAmount . '; ';
								// echo $_id . '; ';
								$sched = db::table('studpayscheddetail')
									->where('studid', $studinfo->id)
									->where('classid', $classid)
									->where('deleted', 0)
									->where('syid', FinanceModel::getSYID())
									->where('semid', $semid)
									->whereNotIn('id', $_id)
									->take(1)
									->get();



								if(count($sched) > 0)									
								{
									array_push($_id, $sched[0]->id);
									// echo 'studpayscheddetail+: ' . $sched[0]->id . '; ';
									db::table('studpayscheddetail')
										->where('id', $sched[0]->id)
										->update([
											'amount' => $sched[0]->amount + $schedAmount,
											'balance' => $sched[0]->balance + $schedAmount,
											'updatedby' => auth()->user()->id,
											'updateddatetime' => FinanceModel::getServerDateTime(),

										]);
									$tAmount -= $schedAmount;
								}
								else
								{
									// echo 'studpayscheddetail-: ' . $sched[0] . '; ';
									$schedid = db::table('studpayscheddetail')
										->insertGetId([
											'studid' => $studinfo->id,
											'semid' => $semid,
											'syid' => FinanceModel::getSYID(),
											'classid' => $classid,
											'particulars' => $description,
											'duedate' => $setup->duedate,
											'amount' => $schedAmount,
											'balance'=> $schedAmount,
											'createdby' => auth()->user()->id,
											'createddatetime' => FinanceModel::getServerDateTime()
										]);

									$tAmount -= $schedAmount;
									array_push($_id, $schedid);

								}

							}
						}

					}
					else //CREDIT
					{
						$paysched = db::table('studpayscheddetail')
							->where('studid', $studinfo->id)
							->where('classid', $classid)
							->where('deleted', 0)
							->get();

						$tAmount = $amount;

						if(count($paysched) > 0)
						{
							$_id = array();
							foreach($paysched as $pay)
							{
								if($tAmount > 0)
								{
									if($tAmount > $pay->balance)
									{
										db::table('studpayscheddetail')
											->where('id', $pay->id)
											->update([
												'amountpay' => $pay->amountpay + $pay->balance,
												'balance' => 0,
												'updatedby' => auth()->user()->id,
												'updateddatetime' => FinanceModel::getServerDateTime()
											]);

										$tAmount -= $pay->balance;

									}
									else
									{
										db::table('studpayscheddetail')
											->where('id', $pay->id)
											->update([
												'amountpay' => $pay->amountpay + $tAmount,
												'balance' => $pay->balance - $tAmount,
												'updatedby' => auth()->user()->id,
												'updateddatetime' => FinanceModel::getServerDateTime(),
											]);										

										$tAmount = 0;
									}
								}

								array_push($_id, $pay->id);
							}


							if($tAmount > 0)
							{
								$paysched = db::table('studpayscheddetail')
									->where('studid', $studinfo->id)
									->whereNotIn('classid', $_id)
									->where('deleted', 0)
									->get();

								foreach($paysched as $pay)
								{
									if($tAmount > 0)
									{
										if($tAmount > $pay->balance)
										{
											db::table('studpayscheddetail')
												->where('id', $pay->id)
												->update([
													'amountpay' => $pay->amountpay + $pay->balance,
													'balance' => 0,
													'updatedby' => auth()->user()->id,
													'updateddatetime' => FinanceModel::getServerDateTime(),
												]);

											$tAmount -= $pay->balance;

										}
										else
										{
											db::table('studpayscheddetail')
												->where('id', $pay->id)
												->update([
													'amountpay' => $pay->amountpay + $tAmount,
													'balance' => $pay->balance - $tAmount,
													'updatedby' => auth()->user()->id,
													'updateddatetime' => FinanceModel::getServerDateTime(),
												]);										

											$tAmount = 0;
										}	
									}
								}
							}
						}
						else
						{
							$paysched = db::table('studpayscheddetail')
								->where('studid', $studinfo->id)
								->where('deleted', 0)
								->get();

							foreach($paysched as $pay)
							{
								if($tAmount > 0)
								{
									if($tAmount > $pay->balance)
									{
										db::table('studpayscheddetail')
											->where('id', $pay->id)
											->update([
												'amountpay' => $pay->amountpay + $pay->balance,
												'balance' => 0,
												'updatedby' => auth()->user()->id,
												'updateddatetime' => FinanceModel::getServerDateTime(),
											]);

										$tAmount -= $pay->balance;

									}
									else
									{
										db::table('studpayscheddetail')
											->where('id', $pay->id)
											->update([
												'amountpay' => $pay->amountpay + $tAmount,
												'balance' => $pay->balance - $tAmount,
												'updatedby' => auth()->user()->id,
												'updateddatetime' => FinanceModel::getServerDateTime(),
											]);										

										$tAmount = 0;
									}	
								}
							}

						}
					}





					//--------------paymentsched--------------//





				}

				return 1;

			}
			else
			{
				return 0;
			}
		}
	}
	
	public function disapproveADJ(Request $request)
	{
		if($request->ajax())
		{
			$adjid = $request->get('adjid');


			$adj = db::table('adjustments')
				->where('id', $adjid)
				->first();


			if($adj->adjstatus == 'SUBMITTED')
			{

				db::table('adjustments')
					->where('id', $adjid)
					->update([
						'adjstatus' => 'DISAPPROVED',
						'adjstatusby' => auth()->user()->id,
						'adjstatusdatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;
			}
			else
			{
				return 0;
			}
		}
	}

	public function deleteADJ(Request $request)
	{
		if($request->ajax())
		{
			$adjid = $request->get('adjid');

			$adj = db::table('adjustments')
				->where('id', $adjid)
				->first();

			if($adj->adjstatus == 'SUBMITTED')
			{
				db::table('adjustments')
					->where('id', $adjid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;	
			}
			else
			{
				return 0;
			}
		}
	}
	
	public function adj_loadclass(Request $request)
	{
		$adjtype = $request->get('adjtype');
		$classification = '';
		$option = '<option value="0"></option>';

		if($adjtype == 'debit')
		{
			$classification = db::table('itemclassification')
				->select('itemclassification.id', 'itemclassification.description')
				->join('chrngsetup', 'itemclassification.id', '=', 'chrngsetup.classid')
				->where('chrngsetup.deleted', 0)
				->where('itemclassification.deleted', 0)
				->where('itemized', 0)
				->orderBy('itemclassification.description')
				->get();
		}
		else
		{
			$classification = db::table('itemclassification')
				->where('deleted', 0)
				->orderBy('itemclassification.description')
				->get();
		}

		foreach($classification as $class)
		{
			$option .='
				<option value="'.$class->id.'">'.$class->description.'</option>
			';
		}

		return $option;
	}

	public function allowdp()
	{
		return view('finance/allowdp');
	}

	public function appendnodp(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			db::table('studinfo')
				->where('id', $studid)
				->update([
					'nodp' => 1,
					'allownodpby' => auth()->user()->id,
					'allownodpdatetime' => FinanceModel::getServerDateTime(),
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);
		}
	}

	public function removenodp(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			db::table('studinfo')
				->where('id', $studid)
				->update([
					'nodp' => 0,
					'removenodpby' => auth()->user()->id,
					'removenodpdatetime' => FinanceModel::getServerDateTime(),
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);
		}
	}

	public function loadstudnodp(Request $request)
	{
		if($request->ajax())
		{
			$students = DB::table('studinfo')
				->select('studinfo.id', 'lrn', 'sid', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'grantee.description as grantee')
				->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
				->join('grantee', 'studinfo.grantee', 'grantee.id')
				->join('studentstatus', 'studinfo.studstatus', '=', 'studentstatus.id')
				->where('studinfo.deleted', 0)
				->where('studstatus', 0)
				->where('studinfo.nodp', 0)
				->orderBy('lastname', 'ASC')
				->orderBy('firstname', 'ASC')
				->get();
				// return $students;
			$list = '<option value="0"></option>';

			foreach($students as $stud)
			{
				$studname = $stud->lrn . ' | ' . $stud->lastname . ', ' . $stud->firstname . ' ' . $stud->middlename . ' ' . $stud->suffix . ' - ' . $stud->levelname;
				$list .='
					<option value="' .$stud->id. '">'.$studname.'</option>
				';				
			}

			echo $list;
		}
	}

	public function searchnodp(Request $request)
	{
		if($request->ajax())
		{
			$filter = $request->get('filter');
			$students = db::table('studinfo')
				->select('studinfo.id', 'lrn', 'sid', 'lastname', 'firstname', 'middlename', 'suffix', 'levelname', 'grantee.description as grantee', 'studentstatus.description as studstatus')
				->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
				->join('grantee', 'studinfo.grantee', 'grantee.id')
				->join('studentstatus', 'studinfo.studstatus', '=', 'studentstatus.id')
				->where('studinfo.deleted', 0)
				->where(function($q) use($filter){
					if($filter != '')
					{
						$q->where('lastname', 'like', '%'.$filter.'%')
							->orWhere('firstname', 'like', '%'.$filter.'%')
							->orWhere('sid', $filter);
					}
				})
				->where('studinfo.nodp', 1)
				->orderBy('lastname', 'ASC')
				->orderBy('firstname', 'ASC')
				->get();

			$list = '';

			foreach($students as $stud)
			{
				$studname = $stud->lastname . ', ' . $stud->firstname . ' ' . $stud->middlename . ' ' . $stud->suffix;

				$list .= '
					<tr>
						<td>'.$stud->lrn.'</td>
						<td>'.$stud->sid.'</td>
						<td>'.$studname.'</td>
						<td>'.$stud->levelname.'</td>
						<td>'.$stud->grantee.'</td>
						<td>'.$stud->studstatus.'</td>
						<td><button class="btn btn-danger removestud" data-id="'.$stud->id.'" toggle="tooltip" title="Remove"><i class="fas fa-trash-alt"></i></button></td>
					</tr>
				';
			}

			echo $list;

		}
	}
	
	public function dploadAcadprog(Request $request)
	{
		if($request->ajax())
		{
			$acadprogram = db::table('academicprogram')
				->get();

			$list = '';

			foreach($acadprogram as $prog)
			{
				$bg = '';
				if($prog->id == 2)
					$bg = 'bg-primary';
				elseif($prog->id == 3)
					$bg = 'bg-warning';
				elseif($prog->id == 4)
					$bg = 'bg-info';
				elseif($prog->id == 5)
					$bg = 'bg-danger';
				elseif($prog->id == 6)
					$bg = 'bg-success';
				elseif($prog->id == 7)
					$bg = 'bg-secondary';

				$list .='
					<div class="col-md-4 acad-prog" style="cursor: pointer;" data-id="'.$prog->id.'">
		              <div id="cardbody" class="card card-body '.$bg.'">
		                '.$prog->progname.'
		              </div>
		            </div>
				';

			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function dploadglevel(Request $request)
	{
		if($request->ajax())
		{
			$acadprogid = $request->get('acadprogid');

			$gradelevel = db::table('gradelevel')
				->where('acadprogid', $acadprogid)
				->where('deleted', 0)
				->orderBy('sortid', 'ASC')
				->get();

			$list = '';

			foreach($gradelevel as $level)
			{
				$checkflag = '';
				$checkesc = '';
				$checkvoucher = '';

				if($level->nodp == 1)
				{
					$checkflag = 'checked';
				}
				else
				{
					$checkflag = '';
				}

				if($level->esc == 1)
				{
					$checkesc = 'checked';
				}
				else
				{
					$checkesc = '';
				}

				if($level->voucher == 1)
				{
					$checkvoucher = 'checked';
				}
				else
				{
					$checkvoucher = '';
				}

				$levlename = str_replace(' ', '', $level->levelname);
				$list .='
					<tr data-id="'.$level->id.'">
						<td>'.$level->levelname.'</td>
						<td class="text-center">
							<div class="icheck-primary d-inline">
		                    	<input data-id="'.$level->id.'" class="chk chknodp" data-value="all" type="checkbox" id="r'.$level->id.'" '.$checkflag.'>
		                        <label for="r'.$level->id.'">
		                    	</label>
		                   	</div>
						</td>
						<td class="text-center">
							<div class="icheck-primary d-inline">
		                    	<input data-id="'.$level->id.'" class="chk chkesc" data-value="esc" type="checkbox" id="esc'.$level->id.'" '.$checkesc.'>
		                        <label for="esc'.$level->id.'">
		                    	</label>
		                   	</div>
						</td>
						<td class="text-center">
							<div class="icheck-primary d-inline">
		                    	<input data-id="'.$level->id.'" class="chk chkvoucher" data-value="voucher" type="checkbox" id="voucher'.$level->id.'" '.$checkvoucher.'>
		                        <label for="voucher'.$level->id.'">
		                    	</label>
		                   	</div>
						</td>
					</tr>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);

		}
	}

	public function togglenodp(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('dataid');
			$nodp = $request->get('nodp');
			$esc = $request->get('esc');
			$voucher = $request->get('voucher');

			if($nodp == 0)
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'nodp' => 0,
						'removenodpby' => auth()->user()->id,
						'removenodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'nodp' => 1,
						'allownodpby' => auth()->user()->id,
						'allownodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);	
			}

			if($esc == 0)
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'esc' => 0,
						'removenodpby' => auth()->user()->id,
						'removenodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'esc' => 1,
						'allownodpby' => auth()->user()->id,
						'allownodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);	
			}

			if($voucher == 0)
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'voucher' => 0,
						'removenodpby' => auth()->user()->id,
						'removenodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'voucher' => 1,
						'allownodpby' => auth()->user()->id,
						'allownodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);	
			}

			
		}
	}

	public function togglenodpesc(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$nodp = $request->get('nodp');

			if($nodp == 0)
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'nodp' => 0,
						'removenodpby' => auth()->user()->id,
						'removenodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'nodp' => 1,
						'allownodpby' => auth()->user()->id,
						'allownodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);	
			}

			
		}
	}

	public function togglenodpvoucher(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$nodp = $request->get('nodp');

			if($nodp == 0)
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'nodp' => 0,
						'removenodpby' => auth()->user()->id,
						'removenodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				db::table('gradelevel')
					->where('id', $levelid)
					->update([
						'nodp' => 1,
						'allownodpby' => auth()->user()->id,
						'allownodpdatetime' => FinanceModel::getServerDateTime(),
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);	
			}

			
		}
	}

	public function cashtrans()
	{
		return view('finance/cashtrans');
	}

	public function cashtranssearch(Request $request)
	{
		if($request->ajax())
		{
			$terminalid = $request->get('terminalno');
			$dtFrom = $request->get('dtfrom');
			$dtTo = $request->get('dtto');
			$search = $request->get('filter');
			$paytype = $request->get('paytype');

			// return $paytype;

			$from = date_create($dtFrom);
			// $from = date_create('01/01/2020');
			$from = date_format($from, 'Y-m-d');
			$to = date_create($dtTo);
			// $to = date_create('01/31/2020');
			$to = date_format($to, 'Y-m-d');

			$from .= ' 00:00';
			$to .= ' 23:59';



			$transactions = db::table('chrngtrans')
				->select('chrngtrans.id', 'ornum', 'transdate', 'totalamount', 'amountpaid', 'studid', 'particulars', 'terminalno', 'transby', 'studname', 'posted', 'sid', 'glevel', 'name', 'cancelled', 'paymenttype.description')
				->join('users', 'chrngtrans.transby', '=', 'users.id')
				->join('paymenttype', 'chrngtrans.paytype', '=', 'paymenttype.description')
				->where('ornum', 'like', '%'. $search . '%')
				->whereBetween('transdate', [$from, $to])
				->where(function($q) use($terminalid){
					if($terminalid > 0)
					{
						$q->where('terminalno', $terminalid);
					}
				})
				->where(function($q) use ($paytype){
					if($paytype != '')
					{
						$q->whereIn('paymenttype.id', $paytype);
					}
				})
				->orWhere('studname', 'like', '%'. $search . '%')
				->whereBetween('transdate', [$from, $to])
				->where(function($q) use($terminalid){
					if($terminalid > 0)
					{
						$q->where('terminalno', $terminalid);
					}
				})
				->where(function($q) use ($paytype){
					if($paytype != '')
					{
						$q->whereIn('paymenttype.id', $paytype);
					}
				})
				// ->orderBy('id', 'DESC')
				->orderBy('ornum', 'ASC')
				->get();

			// return $transactions;

			$output = '';
			$gTotal = 0;
			$count = 0;
			foreach($transactions as $trans)
			{
				$count += 1;
				$tdate = date_create($trans->transdate);
				$tdate = date_format($tdate, 'm-d-Y');

				if($trans->cancelled == 0)
				{
				  $gTotal += $trans->amountpaid;
				}

				if($trans->posted == 0 && $trans->cancelled == 0)
				{
				  $output .='
				    <tr>
				    	<td>'.$count.'</td>
						<td>'.$tdate.'</td>
						<td>'.$trans->ornum.'</td>
						<td>'.strtoupper($trans->studname).'</td>
						<td class="text-right">'.number_format($trans->amountpaid, 2).'</td>
						<td></td>
						<td>'.strtoupper($trans->name).'</td>
						<td>'.$trans->description.'</td>
						<td>
				        	<span class="btn-view btn btn-block btn-primary btn-sm" data-id="'.$trans->id.'">View</span>
				     	</td>
				    </tr>
				  ';
				}
				else if($trans->cancelled == 1)
				{
				  $output .='
				    <tr>
				    	<td>'.$count.'</td>
				     	<td class="text-danger"><del>'.$tdate.'</del></td>
				     	<td class="text-danger"><del>'.$trans->ornum.'</del></td>
				     	<td class="text-danger"><del>'.strtoupper($trans->studname).'</del></td>
				     	<td class="text-right text-danger""><del>'.number_format($trans->amountpaid, 2).'</del></td>
				     	<td class="text-center class="text-danger""></td>
				     	<td class="text-danger"><del>'.strtoupper($trans->name).'</del></td>
				     	<td>'.$trans->description.'</td>
				     	<td colspan="2"><span class="btn-view btn btn-block btn-danger btn-sm" data-id="'.$trans->id.'">View</span></td>
				    </tr>
				  ';
				}
				else
				{
				  $output .='
				    <tr>
				      <td>'.$count.'</td>
				      <td>'.$tdate.'</td>
				      <td>'.$trans->ornum.'</td>
				      <td>'.strtoupper($trans->studname).'</td>
				      <td class="text-right">'.number_format($trans->amountpaid, 2).'</td>
				      <td class="text-center"><i class="fa fa-check"></i></td>
				      <td>'.strtoupper($trans->name).'</td>
				      <td>'.$trans->description.'</td>
				      <td colspan="2"><span class="btn-view btn btn-block btn-primary btn-sm" data-id="'.$trans->id.'">View</span></td>
				    </tr>
				  ';
				}
			}

			$output .='
			<tr style="font-size:larger" class="pay-2">
			  <td colspan = "4" class="text-right text-bold">TOTAL</td>
			  <td class="text-right text-bold"><u>'.number_format($gTotal, 2).'</u></td>
			  <td></td>
			  <td></td>
			  <td></td>
			  <td></td>
			</tr>
			';

			$data = array(
			'list' => $output
			);

			echo json_encode($data);
		}
	}

	public function printcashtrans($terminalid, $dtfrom, $dtto, $filter, $paytype)
	{
		$studinfo = db::table('schoolinfo')
        ->first();

        if($paytype == 0)
	    {
	    	$paytype = '';
	    }
	    else
	    {
	    	$paytype = explode(',', $paytype);
	    }


        
        

	    $schoolname = $studinfo->schoolname;
	    $schooladdress = $studinfo->address;

	    $dtfrom = date_create($dtfrom);
	    $dtfrom = date_format($dtfrom, 'm/d/Y');

	    $dtto = date_create($dtto);
	    $dtto = date_format($dtto, 'm/d/Y');

	    $daterange = 'PERIOD: ' . $dtfrom . ' - ' . $dtto;
	    
	    // return $filter;
	    

	    

	    if($filter == '""')
	    {
	      $filter = '';
	    }
	    else
	    {
	    	$filter = str_replace('"', '', $filter);
	    }

	    

	    $from = date_create($dtfrom);
	    // $from = date_create('01/01/2020');
	    $from = date_format($from, 'Y-m-d');
	    $to = date_create($dtto);
	    // $to = date_create('01/31/2020');
	    $to = date_format($to, 'Y-m-d');

	    $from .= ' 00:00';
	    $to .= ' 23:59';
	    	
	    $transactions = db::table('chrngtrans')
	        ->select('chrngtrans.id', 'ornum', 'transdate', 'totalamount', 'amountpaid', 'studid', 'particulars', 'terminalno', 'transby', 'studname', 'posted', 'sid', 'glevel', 'name', 'cancelled', 'paymenttype.description')
			->join('users', 'chrngtrans.transby', '=', 'users.id')
			->join('paymenttype', 'chrngtrans.paytype', '=', 'paymenttype.description')
			->where('ornum', 'like', '%'. $filter . '%')
			->whereBetween('transdate', [$from, $to])
			->where(function($q) use($terminalid){
				if($terminalid > 0)
				{
					$q->where('terminalno', $terminalid);
				}
			})
			->where(function($q) use ($paytype){
				if($paytype != '')
				{
					$q->whereIn('paymenttype.id', $paytype);
				}
			})
			->orWhere('studname', 'like', '%'. $filter . '%')
			->whereBetween('transdate', [$from, $to])
			->where(function($q) use($terminalid){
				if($terminalid > 0)
				{
					$q->where('terminalno', $terminalid);
				}
			})
			->where(function($q) use ($paytype){
				if($paytype != '')
				{	
					$q->whereIn('paymenttype.id', $paytype);
				}
			})
			->orderBy('id', 'DESC')
			->get();
	    // return $transactions;

	    $transsummary = db::table('chrngtrans')
			->select(db::raw('sum(amountpaid) as totalamount, paytype'))
			->join('users', 'chrngtrans.transby', '=', 'users.id')
			->join('paymenttype', 'chrngtrans.paytype', '=', 'paymenttype.description')
			->where('ornum', 'like', '%'. $filter . '%')
			->where(function($q) use ($terminalid){
	        	if($terminalid != 0)
	        	{
	        		$q->where('terminalno', $terminalid);
	        	}
	        })
	        ->where(function($q) use ($paytype){
					if($paytype != '')
					{
						$q->whereIn('paymenttype.id', $paytype);
					}
				})
	        ->where(function($q) use ($paytype){
					if($paytype != '')
					{
						$q->whereIn('paymenttype.id', $paytype);
					}
				})
			->whereBetween('transdate', [$from, $to])
			->where('cancelled', 0)
			->orWhere('studname', 'like', '%'. $filter . '%')
			->where(function($q) use ($terminalid){
	        	if($terminalid != 0)
	        	{
	        		$q->where('terminalno', $terminalid);
	        	}
	        })
	        ->where(function($q) use ($paytype){
					if($paytype != '')
					{
						$q->whereIn('paymenttype.id', $paytype);
					}
				})
	        ->where(function($q) use ($paytype){
					if($paytype != '')
					{
						$q->whereIn('paymenttype.id', $paytype);
					}
				})
			->whereBetween('transdate', [$from, $to])
			->where('cancelled', 0)
			->groupBy('paytype')
			->get();

		$ptypedesc = '';
		if($paytype != '')
		{
			$paytypedesc = db::table('paymenttype')
				->whereIn('id', $paytype)
				->get();

			if(count($paytypedesc) > 0)
			{
				foreach($paytypedesc as $desc)
				{
					if($ptypedesc == '')
					{
						$ptypedesc .= $desc->description;
					}
					else
					{
						$ptypedesc .= ', ' . $desc->description;
					}
				}
			}
		}

	    $data = array(
			'terminalid' => $terminalid,
			'schoolname' => $schoolname,
			'schooladdress' => $schooladdress,
			'daterange' => $daterange,
			'transactions' => $transactions,
			'datenow' => FinanceModel::getServerDateTime(),
			'transsummary' => $transsummary,
			'filter' => '"' . $filter . '"',
			'paytype' => $ptypedesc
		);

		$pdf = PDF::loadView('/finance/printcashtrans', $data)->setPaper('legal','portrait');
	    $pdf->getDomPDF()->set_option("enable_php", true);
	    return $pdf->stream('cashiertransactions.pdf');
	}

	// public function transviewdetail(Request $request)
	// {
	// 	if($request->ajax())
	// 	{
	// 		$transid = $request->get('transid');

	// 		$idno = '';
	// 		$studname = '';
	// 		$gradelevel = '';
	// 		$ornum = '';

	// 		$totalamount = 0;
	// 		$list = '';
	// 		$cancelled = 0;

	// 		$chrngtrans = db::table('chrngtrans')
	//          	->select('chrngtrans.id', 'sid', 'studname', 'glevel', 'amountpaid', 'amount', 'qty', 'items', 'transdate', 'ornum', 'itemprice', 'cancelled')
	//          	->join('chrngtransdetail', 'chrngtrans.id', '=', 'chrngtransdetail.chrngtransid')
	//         	->where('chrngtrans.id', $transid)
	//          	->get();

	//         if(count($chrngtrans) > 0)
	//         {
	//         	foreach($chrngtrans as $trans)
	//         	{
	//         		$transdate = date_create($trans->transdate);
	//         		$transdate = date_format($transdate, 'm-d-Y');

	//         		$idno = $trans->sid;
	//         		$studname = $trans->studname;
	//         		$gradelevel = $trans->glevel;
	//         		$ornum = $trans->ornum;
	//         		$cancelled = $trans->cancelled;

	//         		$totalamount += $trans->amount;

	//         		$list .='
	//         			<tr>
	//         				<td>'.$trans->items.'</td>
	//         				<td class="text-right">'.number_format($trans->amount,2).'</td>
	//         			</tr>
	//         		';
	//         	}

	//         	$list .='
	//         		<tr>
	//         			<td class="text-bold text-right">TOTAL</td>
	//         			<td class="text-bold text-right">'.number_format($totalamount,2).'</td>
	//         		</tr>
	//         	';
	//         }

	//         $data = array(
	//         	'list' =>$list,
	//         	'ornum' => $ornum,
	//         	'studname' => $studname,
	//         	'gradelevel' => $gradelevel,
	//         	'idno' => $idno,
	//         	'transdate' => $transdate,
	//         	'cancelled' => $cancelled
	//         );

	//         echo json_encode($data);
	// 	}
	// }

	public function transviewdetail(Request $request)
	{
		if($request->ajax())
		{
			$transid = $request->get('transid');

			$idno = '';
			$studname = '';
			$gradelevel = '';
			$ornum = '';

			$totalamount = 0;
			$list = '';
			$cancelled = 0;

			$transaction = db::table('chrngtrans')
				->where('id', $transid)
				->where('cancelled', 0)
				->first();

			
			$chrngtrans = db::table('chrngtrans')
				->select('chrngtrans.id', 'sid', 'studname', 'glevel', 'amountpaid', 'amount', 'qty', 'items', 'transdate', 'ornum', 'itemprice', 'cancelled')
				->join('chrngtransdetail', 'chrngtrans.id', '=', 'chrngtransdetail.chrngtransid')
				->where('chrngtrans.id', $transid)
				->get();

			if($transaction){
				// Calculate sum from detailed transactions
				$detailedSum = collect($chrngtrans)->sum('amount');
				
				// Check if detailed sum matches the transaction amount paid
				if ($detailedSum != $transaction->amountpaid) {
					// If amounts don't match, use chrngcashtrans data instead
					$chrngtrans = DB::table('chrngcashtrans')
						->where('transno', $transaction->transno)
						->get();
				}
			}
		
			if(count($chrngtrans) > 0)
			{
				foreach($chrngtrans as $trans)
				{
					// Check if we're using chrngcashtrans or chrngtransdetail
					if(isset($trans->particulars)) {
						// Using chrngcashtrans data
						$transdate = date_create($trans->duedate);
						$transdate = date_format($transdate, 'm-d-Y');

						// Get student info from main transaction since chrngcashtrans doesn't have it
						$idno = $transaction->sid ?? '';
						$studname = $transaction->studname ?? '';
						$gradelevel = $transaction->glevel ?? '';
						$ornum = $transaction->ornum ?? '';
						$cancelled = $transaction->cancelled ?? 0;

						$totalamount += $trans->amount;

						$list .='
							<tr>
								<td>'.$trans->particulars.'</td>
								<td class="text-right">'.number_format($trans->amount,2).'</td>
							</tr>
						';
					} else {
						// Using original chrngtransdetail data
						$transdate = date_create($trans->transdate);
						$transdate = date_format($transdate, 'm-d-Y');

						$idno = $trans->sid;
						$studname = $trans->studname;
						$gradelevel = $trans->glevel;
						$ornum = $trans->ornum;
						$cancelled = $trans->cancelled;

						$totalamount += $trans->amount;

						$list .='
							<tr>
								<td>'.$trans->items.'</td>
								<td class="text-right">'.number_format($trans->amount,2).'</td>
							</tr>
						';
					}
				}

				$list .='
					<tr>
						<td class="text-bold text-right">TOTAL</td>
						<td class="text-bold text-right">'.number_format($totalamount,2).'</td>
					</tr>
				';
			}

			$data = array(
				'list' =>$list,
				'ornum' => $ornum,
				'studname' => $studname,
				'gradelevel' => $gradelevel,
				'idno' => $idno,
				'transdate' => $transdate,
				'cancelled' => $cancelled
			);

			echo json_encode($data);
		}
	}

	public function viewpaysched(Request $request)
	{
		if($request->ajax())
		{
			$tuitionid = $request->get('tuitionid');
			
			$headeramount = 0;
			$divamount = 0;
			$curAmount = 0;
			$payopt = '';

			$test_data = array();

			$tuitionheader = db::table('tuitionheader')
				->select('tuitionheader.id AS tuitionid', 'tuitionheader.description', 'itemclassification.description as classdesc', 'pschemeid', 'tuitiondetail.amount')
				->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
				->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
				->where('tuitionheader.id', $tuitionid)
				->where('tuitionheader.deleted', 0)
				->where('tuitiondetail.deleted', 0)
				->get();

			// return $tuitionheader;

			if(count($tuitionheader) > 0)
			{

				db::table('paymentsched')->truncate();



				foreach($tuitionheader as $theader)
				{
					$paysetup = db::table('paymentsetup')
						->where('id', $theader->pschemeid)
						->first();

					$headeramount = $theader->amount;
					$curAmount = $headeramount;
					$divamount = $headeramount / $paysetup->noofpayment;
					$divamount = number_format($divamount, 2, '.', '');

					// return $divamount;

					if($paysetup->payopt == 'divided')//divided
					{
						$paydetail = db::table('paymentsetupdetail')
							->where('paymentid', $theader->pschemeid)
							->where('deleted', 0)
							->get();

						if(count($paydetail) > 0)
						{
							$paycount = 0;
							foreach($paydetail as $detail)
							{
								$paycount += 1;
								if($curAmount > 0)
								{
									$month = date_create($detail->duedate);
									$month = date_format($month, 'F');
									
									if($paycount < $paysetup->noofpayment)
									{
										
										
										$_data = array(
											'duedate' => $month,
											'description' => $theader->classdesc,
											'amount' => $divamount,
											'sortid' => $detail->paymentno
										);

										db::table('paymentsched')
											->insert([
												'duedate' => $month,
												'description' => $theader->classdesc,
												'amount' => $divamount,
												'sortid' => $detail->paymentno,
												'payopt' => $paysetup->payopt
												// 'headeramount' => $headeramount,
												// 'divamount' => $divamount,
												// 'curAmount' => $curAmount
											]);

										$curAmount -= $divamount;
										$curAmount = number_format($curAmount, '2', '.', '');

										array_push($test_data, $_data);

									}
									else
									{
										if($curAmount > 0)
										{
											$_data = array(
												'duedate' => $month,
												'description' => $theader->classdesc,
												'amount' => $divamount,
												'sortid' => $detail->paymentno
											);

											db::table('paymentsched')
												->insert([
													'duedate' => $month,
													'description' => $theader->classdesc,
													'amount' => $curAmount,
													'sortid' => $detail->paymentno,
													'payopt' => $paysetup->payopt
													// 'headeramount' => $headeramount,
													// 'divamount' => $divamount,
													// 'curAmount' => $curAmount
												]);	
											
											$curAmount = 0;

											array_push($test_data, $_data);										
										}

									}
								}
							}
						}
					}
					else
					{
						$paydetail = db::table('paymentsetupdetail')
							->where('paymentid', $theader->pschemeid)
							->where('deleted', 0)
							->get();

						$data = array();
						$pAmount = 0;
						$paycount = 0;

						// return count($paydetail);

						
						
							
						foreach($paydetail as $detail)
						{
							$paycount +=1;
							if($paycount < count($paydetail))
							{
								$dateDue = date_create($detail->duedate);
								$dateDue = date_format($dateDue, 'F');

								if($paycount < count($paydetail))
								{
									$pAmount = round($detail->percentamount * ($headeramount/100), 2);

									$curAmount = (round($curAmount - $pAmount, 2));

									$_data = db::table('paymentsched')
										->insert([
											'description' => $theader->classdesc,
											'amount' => $pAmount,
											'duedate' => $dateDue,
											'sortid' => $detail->paymentno,
											'payopt' => $paysetup->payopt,
											// 'curAmount' => $curAmount,
											// 'headeramount' => $headeramount
										]);

									// array_push($data, $_data);
								}
							}
							else
							{
								if($curAmount > 0)
								{
									$_data = db::table('paymentsched')
										->insert([
											'description' => $theader->classdesc,
											'amount' => $curAmount,
											'duedate' => $dateDue,
											'sortid' => $detail->paymentno,
											'payopt' => $paysetup->payopt,
											// 'curAmount' => $curAmount,
											// 'headeramount' => $headeramount
										]);							

									$curAmount = 0;

									// array_push($data, $_data);
								}
							}
						}
						
						// return $data;
					}


					

					$list ='';
					$totalamount = 0;
					$paysched = db::table('paymentsched')
						->select('sortid', 'duedate', 'payopt')
						->orderBy('sortid', 'ASC')
						->groupBy('sortid')
						->get();

					// return $paysched;

					
					foreach($paysched as $psched)
					{

						$list .='
							<div class="col-md-4">
								<div class="card text-sm">
									<div class="card-header bg-secondary">
									  '.$psched->duedate.' | '.strtoupper($psched->payopt).'
									</div>
									<div class="card-body">
						';

						$sched = db::table('paymentsched')
							->where('sortid', $psched->sortid)
							->get();

						foreach($sched as $s)
						{

							$totalamount += $s->amount;
							$list .= '
						                  <div class="row">
						                    <div class="col-md-8">
						                      '.$s->description.'
						                    </div>
						                    <div class="col-md-4 text-right text-bold">
						                      '.number_format($s->amount, 2).'
						                    </div>
						                  </div>
						                
							';	
						}

						$list .='
							</div>
							<div class="card-footer">
					                  <div class="row">
					                    <div class="col-md-8 text-right">
					                      <b>TOTAL:</b>
					                    </div>
					                    <div class="col-md-4 text-right">
					                      '.number_format($totalamount, 2).'
					                    </div>
					                  </div>
					                </div>
					              </div>
					            </div>            
					         </div>
						';

						$totalamount = 0;


						
					}

					


				}
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
			// return $test_data;
		}
	}

	public function chartofaccounts()
	{
		return view('finance/chartofaccounts');
	}

	public function loadchart(Request $request)
	{
		if($request->ajax())
		{
			$groupid = $request->get('groupid');
			$accname = $request->get('accname');

			$chartgroup = db::table('acc_coagroup')
				->where(function($q) use($groupid){
					if($groupid != 0)
					{
						$q->where('id', $groupid);
					}
				})
				->where('deleted', 0)
				->orderBy('sortid', 'ASC')
				->get();

			$coalist = '';

			foreach($chartgroup as $group)
			{
				$coalist .='
					<tr class="text-bold" data-value="group" data-id="'.$group->id.'">
						<td colspan="4">'.$group->group.'</td>
					</tr>
				';


				$chartlist = db::table('acc_coa')
					->select('acc_coa.id as coaid', 'code', 'account', 'groupid', 'classification', 'mapname')
					->join('acc_coagroup', 'acc_coa.gid', '=', 'acc_coagroup.id')
					->join('acc_coaclass', 'acc_coagroup.coaclass', '=', 'acc_coaclass.id')
					->leftjoin('acc_map', 'acc_coa.mapid', '=', 'acc_map.id')
					->where('sub1', 0)
					->where('sub2', 0)
					->where('gid', $group->id)
					->where('account', 'like', '%'.$accname.'%')
					->where('acc_coa.deleted', 0)
					->orWhere('sub1', 0)
					->where('sub2', 0)
					->where('gid', $group->id)
					->where('code', 'like', '%'.$accname.'%')
					->where('acc_coa.deleted', 0)
					->orderBy('code', 'ASC')
					->get();

				foreach($chartlist as $list)
				{
					$coalist .= '
						<tr data-value="acc" data-id="'.$list->coaid.'">
							<td>'.$list->code.'</td>
							<td>'.$list->account.'</td>
							<td>'.$list->classification.'</td>
							<td>'.$list->mapname.'</td>
						</tr>
					';

					$sublist = db::table('acc_coa')
						->select('acc_coa.id as coaid', 'code', 'account', 'groupid', 'classification', 'mapname')
						->join('acc_coagroup', 'acc_coa.gid', '=', 'acc_coagroup.id')
						->join('acc_coaclass', 'acc_coagroup.coaclass', '=', 'acc_coaclass.id')
						->leftjoin('acc_map', 'acc_coa.mapid', '=', 'acc_map.id')
						->where('sub1id', $list->coaid)
						->where('acc_coa.deleted', 0)
						->orderBy('code', 'ASC')
						->get();

					if(count($sublist) > 0)
					{
						foreach($sublist as $sub)
						{
							$coalist .='
								<tr class="font-italic" data-value="sub" data-id="'.$sub->coaid.'">
									<td></td>
									<td> '.$sub->code.' - '.$sub->account.'</td>
									<td>'.$sub->classification.'</td>
									<td>'.$sub->mapname.'</td>
								</tr>			
							';

							$itemlist = db::table('acc_coa')
								->select('acc_coa.id as coaid', 'code', 'account', 'groupid', 'classification', 'mapname')
								->join('acc_coagroup', 'acc_coa.gid', '=', 'acc_coagroup.id')
								->join('acc_coaclass', 'acc_coagroup.coaclass', '=', 'acc_coaclass.id')
								->leftjoin('acc_map', 'acc_coa.mapid', '=', 'acc_map.id')
								->where('sub2id', $sub->coaid)
								->where('acc_coa.deleted', 0)
								->orderBy('code', 'ASC')
								->get();

							if(count($itemlist) >0)
							{
								foreach($itemlist as $ilist)
								{
									$coalist .='
										<tr class="font-italic" data-value="item" data-id="'.$ilist->coaid.'">
											<td></td>
											<td class="pl-5"> '.$ilist->code.' - '.$ilist->account.'</td>
											<td>'.$ilist->classification.'</td>
											<td>'.$ilist->mapname.'</td>
										</tr>			
									';
								}
							}


						}
					}
				}
			}

			$data = array(
				'coalist' => $coalist
			);

			echo json_encode($data);
		}
	}

	public function loadgroup(Request $request)
	{
		if($request->ajax())
		{
			$gid = $request->get('gid');

			$maplist = db::table('acc_map')
				->where('deleted', 0)
				->get();

			$maps = '<option value="0">Select Mapping</option>';

			foreach($maplist as $map)
			{
				$maps .='
					<option value="'.$map->id.'">'.$map->mapname.'</option>
				';
			}

			$acc_coa = db::table('acc_coa')
				->where('gid', $gid)
				->max('code');

			$acc_coagroup = db::table('acc_coagroup')
				->where('id', $gid)
				->first();

			// return $acc_coagroup;

			// return $acc_coagroup->group;

			$data = array(
				'gid' => $acc_coagroup->id,
				'code' => $acc_coa + 1,
				'groupid' => $acc_coagroup->group . ' <i class="far fa-edit" data-toggle="tooltip" title="Edit"></i>',
				'maplist' => $maps,
				'acctitle' => $acc_coagroup->group
			);

			echo json_encode($data);

			
		}
	}

	public function saveacctype(Request $request)
	{
		if($request->ajax())
		{
			$acctype = $request->get('acctype');
			$classid = $request->get('classid');
			$sortid = $request->get('sortid');

			$check = db::table('acc_coagroup')
				->where('group', $acctype)
				->where('deleted', 0)
				->count();


			if($check > 0)
			{
				return 0;
			}
			else
			{
				db::table('acc_coagroup')
					->insert([
						'group' => $acctype,
						'coaclass' => $classid,
						'sortid' => $sortid,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
				return 1;
			}
		}
	}

	public function editacctype(Request $request)
	{
		if($request->ajax())
		{
			$groupid = $request->get('groupid');

			$group = db::table('acc_coagroup')
				->where('id', $groupid)
				->first();

			$data = array(
				'group' => $group->group,
				'classid' => $group->coaclass,
				'sortid' => $group->sortid
			);

			echo json_encode($data);
		}
	}

	public function updateacctype(Request $request)
	{
		if($request->ajax())
		{
			$groupid = $request->get('groupid');
			$acctype = $request->get('acctype');
			$classid = $request->get('classid');
			$sortid = $request->get('sortid');

			$gid = array();

			array_push($gid, $groupid);

			$check = db::table('acc_coagroup')
				->where('group', $acctype)
				->where('deleted', 0)
				->whereNotIn('id', $gid)
				->count();

			if($check > 0)
			{
				$return = 0;
			}
			else
			{
				db::table('acc_coagroup')
					->where('id', $groupid)
					->update([
						'group' => $acctype,
						'coaclass' => $classid,
						'sortid' => $sortid,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
				$return = 1;
			}

			$data = array(
				'return' => $return,
				'acctype' => $acctype . ' <i class="far fa-edit" data-toggle="tooltip" title="Edit"></i>'
			);

			echo json_encode($data);
		}
	}

	public function saveaccname(Request $request)
	{
		if($request->ajax())
		{
			$code = $request->get('code');
			$accname = $request->get('accname');
			$mapid = $request->get('mapid');
			$group = $request->get('group');
			$gid = $request->get('gid');

			$checkcode = db::table('acc_coa')
				->where('code', $code)
				->where('deleted', 0)
				->count();

			if($checkcode > 0)
			{
				return 0;
			}
			else
			{
				$checkaccname = db::table('acc_coa')
					->where('account', $accname)
					->where('deleted', 0)
					->count();

				if($checkaccname > 0)
				{
					return 0;
				}
				else
				{
					db::table('acc_coa')
						->insert([
							'code' => $code,
							'account' => $accname,
							'mapid' => $mapid,
							'groupid' => $group,
							'gid' => $gid,
							'createdby' => auth()->user()->id,
							'createddatetime' => FinanceModel::getServerDateTime()
						]);

					return 1;
				}
			}
		}
	}

	public function loadaccname(Request $request)
	{
		if($request->ajax())
		{
			$accid = $request->get('accid');
			$headcode = '';

			$account = db::table('acc_coa')
				->where('id', $accid)
				->first();

			$subaccount = db::table('acc_coa')
				->where('sub1id', $accid)
				->max('code');

			$mapping = FinanceModel::loadcoaMap();

			// return $mapping;

			$maplist = '<option value="0">Select Mapping</option>';

			foreach($mapping as $map)
			{
				$maplist .='
					<option value="'.$map->id.'">'.$map->mapname.'</option>
				';
			}

			// return $subaccount;

			if(! $subaccount)
			{
				$headcode = $account->code;
			}
			else
			{
				$headcode = $subaccount + 1;
			}



			$data = array(
				'accid' => $account->id,
				'headcode' => $headcode,
				'accname' => $account->account . ' <i class="far fa-edit"></i>',
				'maplist' => $maplist
			);

			echo json_encode($data);

		}
	}
	
	public function editaccname(Request $request)
	{
		if($request->ajax())
		{
			$accid = $request->get('accid');

			$account = db::table('acc_coa')
				->where('id', $accid)
				->first();

			$acclist = '<option value="0">Select Accout Title</option>';

			$accnamelist = db::table('acc_coa')
				->where('id', '!=', $accid)
				->where('deleted', 0)
				->orderBy('code', 'ASC')
				->get();

			foreach($accnamelist as $aname)
			{
				$acclist .='
					<option value="'.$aname->id.'">'.$aname->account.'</option>
				';
			}

			$acctype = db::table('acc_coagroup')
				->where('deleted', 0)
				->orderBy('sortid', 'ASC')
				->get();

			$typelist = '<option value="0">Select Account Type</option>';

			foreach($acctype as $type)
			{
				$typelist .='
					<option value="'.$type->id.'">'.$type->group.'</option>
				';
			}

			$mapping = FinanceModel::loadcoaMap();

			$maplist = '<option value="0">Select Mapping</option>';

			foreach($mapping as $map)
			{

				if($account->mapid == $map->id)
				{
					$maplist .='
						<option selected value="'.$map->id.'">'.$map->mapname.'</option>
					';
				}
				else
				{
					$maplist .='
						<option value="'.$map->id.'">'.$map->mapname.'</option>
					';
				}

					
			}


			$data = array(
				'accid' => $account->id,
				'code' => $account->code,
				'accname' => $account->account,
				'mapid' => $account->mapid, 
				'maplist' => $maplist,
				'acclist' => $acclist,
				'typelist' => $typelist
			);

			echo json_encode($data);

		}
	}

	public function updateaccname(Request $request)
	{
		if($request->ajax())
		{
			$accid = $request->get('accid');
			$code = $request->get('code');
			$accname = $request->get('accname');
			$mapid = $request->get('mapid');

			

			$arrayid = array();

			array_push($arrayid, $accid);

			$checkcode = db::table('acc_coa')
				->where('code', $code)
				->where('deleted', 0)
				->whereNotIn('id', $arrayid)
				->count();
			if($checkcode > 0)
			{
				$return = 0;
			}
			else
			{
				$checkacc = db::table('acc_coa')
					->where('account', $accname)
					->where('deleted', 0)
					->whereNotIn('id', $arrayid)
					->count();

				if($checkacc > 0)
				{
					$return = 0;
				}
				else
				{
					db::table('acc_coa')
						->where('id', $accid)
						->update([
							'code' => $code,
							'account' => $accname,
							'mapid' => $mapid,
							'updatedby' =>auth()->user()->id,
							'updateddatetime' => FinanceModel::getServerDateTime()
						]);
					$return = 1;
				}
			}

			$data = array(
				'accname' => $accname . ' <i class="far fa-edit"></i>',
				'return' => $return
			);

			echo json_encode($data);
		}
	}

	public function savesubname(Request $request)
	{
		if($request->ajax())
		{
			$headid = $request->get('headid');
			$code = $request->get('code');
			$accname = $request->get('accname');
			$mapid = $request->get('mapid');

			$head = db::table('acc_coa')
				->where('id', $headid)
				->first();

			// return $head;

			$groupid = $head->groupid;
			$gid = $head->gid;

			$checkcode = db::table('acc_coa')
				->where('code', $code)
				->where('deleted', 0)
				->count();


			if($checkcode > 0)
			{
				return 0;
			}
			else
			{
				$checkaccname = db::table('acc_coa')
					->where('account', $accname)
					->where('deleted', 0)
					->count();				

				if($checkaccname > 0)
				{
					return 0;
				}
				else
				{
					db::table('acc_coa')
						->insert([
							'code' => $code,
							'account' => $accname,
							'mapid' => $mapid,
							'groupid' => $groupid,
							'gid' => $gid,
							'sub1' => 1,
							'sub1id' => $headid,
							'createdby' => auth()->user()->id,
							'createddatetime' => FinanceModel::getServerDateTime()
						]);

					return 1;
				}
			}
		}
	}

	public function coamapping()
	{
		return view('finance/coamapping');
	}

	public function savemapping(Request $request)
	{
		if($request->ajax())
		{
			$desc = $request->get('desc');

			$check = db::table('acc_map')
				->where('mapname', $desc)
				->where('deleted', 0)
				->count();

			if($check > 0)
			{
				return 0;
			}
			else
			{
				db::table('acc_map')
					->insert([
					'mapname' => $desc,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

				return 1;
			}
		}
	}

	public function loadmapping(Request $request)
	{
		if($request->ajax())
		{
			$filter = $request->get('filter');

			$mapping = db::table('acc_map')
				->where('mapname', 'like', '%'. $filter . '%')
				->where('deleted', 0)
				->get();


			$list = '';

			foreach($mapping as $map)
			{
				$list .='
					<tr data-id="'.$map->id.'">
						<td>'.$map->mapname.'</td>
					</tr>
				';
			}

			$data = array(
				'list' => $list
			);
			echo json_encode($data);
		}
	}

	public function editmapping(Request $request)
	{
		if($request->ajax())
		{
			$mapid = $request->get('mapid');
			

			$map = db::table('acc_map')
				->where('id', $mapid)
				->first();

			$data = array(
				'mapname' => $map->mapname
			);


			echo json_encode($data);

		}
	}

	public function updatemapping(Request $request)
	{
		if($request->ajax())
		{
			$mapid = $request->get('mapid');
			$mapname = $request->get('mapname');

			$maparray = array();
			array_push($maparray, $mapid);

			$check = db::table('acc_map')
				->where('mapname', $mapname)
				->whereNotIn('id', $maparray)
				->count();

			if($check > 0)
			{
				return 0;
			}
			else
			{
				db::table('acc_map')
					->where('id', $mapid)
					->update([
						'mapname' => $mapname,
						'updatedby' => auth()->user()->id,
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;
			}

		}
	}

	public function deleteacctype(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			$check = db::table('acc_coa')
				->where('gid', $dataid)
				->where('deleted', 0)
				->count();


			if($check > 0)
			{
				return 0;
			}
			else
			{
				db::table('acc_coagroup')
					->where('id', $dataid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;
			}
		}
	}

	public function switchacc(Request $request)
	{
		if($request->ajax())
		{
			$accid = $request->get('accid');
			$acctypeid = $request->get('acctypeid');
            $acctitle = $request->get('acctitle');
            $optswitch = $request->get('optswitch');


            if($acctypeid == '' || $acctitle == '')
            {
            	return 0;
            }

            if($optswitch == 1)
            {
            	$acctype = db::table('acc_coagroup')
            		->where('id', $acctypeid)
            		->first();

            	$acc = db::table('acc_coa')
            		->where('id', $accid)
            		->update([
            			'groupid' => $acctype->group,
            			'gid' => $acctype->id,
            			'sub1' => 0,
            			'sub1id' => null,
            			'updatedby' => auth()->user()->id,
            			'updateddatetime' => FinanceModel::getServerDateTime()
            		]);

            	return 1;
            }
            elseif($optswitch == 2)
            {
            	$acc = db::table('acc_coa')
            		->where('id', $acctitle)
            		->first();

            	$account = db::table('acc_coa')
            		->where('id', $accid)
            		->update([
            			'groupid' => $acc->groupid,
            			'gid' => $acc->gid,
            			'sub1' => 1,
            			'sub1id' => $acc->id,
            			'updatedby' => auth()->user()->id,
            			'updateddatetime' => FinanceModel::getServerDateTime()
            		]);
            	return 1;
            }
            else
            {
            	return 0;
            }
		}
	}

	public function  editsubitem(Request $request)
	{
		if($request->ajax())
		{
			$subitemid = $request->get('subitemid');

			$subitem = db::table('acc_coa')
				->where('id', $subitemid)
				->first();

			$mapping = db::table('acc_map')
				->where('deleted', 0)
				->get();

			$maplist = '<option value="0">Select Mapping</option>';
			// return $subitemid;
			foreach($mapping as $map)
			{
				if($subitem->mapid == $map->id)
				{
					$maplist .='
						<option value="'.$map->id.'" selected>'.$map->mapname.'</option>					
					';
				}
				else
				{
					$maplist .='
						<option value="'.$map->id.'">'.$map->mapname.'</option>					
					';	
				}
			}

			$data = array(
				'code' => $subitem->code,
				'accname' => $subitem->account,
				'maplist' => $maplist
			);

			echo json_encode($data);
		}
	}

	public function loadsubname(Request $request)
	{
		if($request->ajax())
		{
			$subid = $request->get('subid');

			$sub = db::table('acc_coa')
				->where('id', $subid)
				->first();

			$mapping = FinanceModel::loadcoaMap();

			$maplist = '<option value="0">Select Mapping</option>';

			foreach($mapping as $map)
			{
				$maplist .='
					<option value="'.$map->id.'">'.$map->mapname.'</option>
				';
			}

			$subitem = db::table('acc_coa')
				->where('sub2id', $subid)
				->max('code');


			if($subitem > 0)
			{
				$code = $subitem + 1;
			}
			else
			{
				$code = $sub->code;
			}

			

			$data = array(
				'subname' => $sub->account . ' <i class="far fa-edit"></i>',
				'subid' => $sub->id,
				'code' => $code,
				'maplist' => $maplist
			);

			echo json_encode($data);
 		}
	}

	public function editsubname(Request $request)
	{
		if($request->ajax())
		{
			$subid = $request->get('subid');

			$sub = db::table('acc_coa')
				->where('id', $subid)
				->first();

			$code = $sub->code;
			$accname = $sub->account;

			$mapping = db::table('acc_map')
				->where('deleted', 0)
				->get();

			$maplist = '<option value="0">Select Mapping</option>';
			// return $subitemid;
			foreach($mapping as $map)
			{
				if($sub->mapid == $map->id)
				{
					$maplist .='
						<option value="'.$map->id.'" selected>'.$map->mapname.'</option>					
					';
				}
				else
				{
					$maplist .='
						<option value="'.$map->id.'">'.$map->mapname.'</option>					
					';	
				}
			}

			$data = array(
				'code' => $code,
				'accname' => $accname,
				'maplist' => $maplist
			);

			echo json_encode($data);
		}
	}

	public function updatesubname(Request $request)
	{
		if($request->ajax())
		{
			$subid = $request->get('subid');
            $code = $request->get('code');
            $accname = $request->get('accname');
            $mapid = $request->get('mapid');

            $idarry = array();

            array_push($idarry, $subid);


            $check = db::table('acc_coa')
            	->where('code', $code)
            	->whereNotIn('id', $idarry)
            	->orWhere('account', $accname)
            	->whereNotIn('id', $idarry)
            	->count();

            if($check > 0)
            {
            	$return = 0;
            }
            else
            {
	            db::table('acc_coa')
	            	->where('id', $subid)
	            	->update([
	            		'code' => $code,
	            		'account' => $accname,
	            		'mapid' => $mapid,
	            		'updatedby' => auth()->user()->id,
	            		'updateddatetime' => FinanceModel::getServerDateTime()
	            	]);

	            $return = 1;
            }

            $data = array(
            	'return' => $return,
            	'subname' => $accname . ' <i class="far fa-edit"></i>'
            );

            echo json_encode($data);
		}
	}

	public function deleteaccname(Request $request)
	{
		if($request->ajax())
		{
			$accid = $request->get('accid');

			$checksub = db::table('acc_coa')
				->where('sub1id', $accid)
				->where('deleted', 0)
				->count();

			if($checksub > 0)
			{
				return 0;
			}
			else
			{
				$checkitemclass = db::table('itemclassification')
					->where('glid', $accid)
					->where('deleted', 0)
					->count();

				if($checkitemclass > 0)
				{
					return 0;
				}
				else
				{
					db::table('acc_coa')
						->where('id', $accid)
						->update([
							'deleted' => 1,
							'deletedby' => auth()->user()->id,
							'deleteddatetime' => FinanceModel::getServerDateTime()
						]);

					return 1;
				}
			}
		}
	}

	public function deletesubname(Request $request)
	{
		if($request->ajax())
		{
			$subid = $request->get('subid');

			$checksub = db::table('acc_coa')
				->where('sub2id', $subid)
				->where('deleted', 0)
				->count();

			if($checksub > 0)
			{
				return 0;
			}
			else
			{
				$checkitemclass = db::table('itemclassification')
					->where('glid', $subid)
					->where('deleted', 0)
					->count();

				if($checkitemclass > 0)
				{
					return 0;
				}
				else
				{
					db::table('acc_coa')
						->where('id', $subid)
						->update([
							'deleted' => 1,
							'deletedby' => auth()->user()->id,
							'deleteddatetime' => FinanceModel::getServerDateTime()
						]);

					return 1;
				}
			}
		}
	}

	public function savesubitem(Request $request)
	{
		if($request->ajax())
		{
			$code = $request->get('code');
            $accname = $request->get('accname');
            $mapid = $request->get('mapid');
            $subid = $request->get('subid');

            $sub = db::table('acc_coa')
            	->where('id', $subid)
            	->first();

            $check = db::table('acc_coa')
            	->where('code', $code)
            	->where('deleted', 0)
            	->orWhere('account', $accname)
            	->where('deleted', 0)
            	->count();

            if($check > 0)
            {
            	return 0;
            }
            else
            {
            	db::table('acc_coa')
            		->insert([
            			'code' => $code,
            			'account' => $accname,
            			'mapid' => $mapid,
            			'groupid' => $sub->groupid,
            			'gid' => $sub->gid,
            			'sub2' => 1,
            			'sub2id' => $subid,
            			'createdby' => auth()->user()->id,
            			'createddatetime' => FinanceModel::getServerDateTime()
            		]);

            	return 1;
            }

		}
	}

	public function updatesubitem(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');
         	$code = $request->get('code');
         	$accname = $request->get('accname');
         	$mapid = $request->get('mapid');

         	$arrayid = array();

         	array_push($arrayid, $itemid);

         	$check = db::table('acc_coa')
         		->where('code', $code)
         		->whereNotIn('id', $arrayid)
         		->orWhere('account', $accname)
         		->whereNotIn('id', $arrayid)
         		->count();

         	if($check > 0)
         	{
         		return 0;
         	}
         	else
         	{
         		db::table('acc_coa')
         			->where('id', $itemid)
         			->update([
         				'code' => $code,
         				'account' => $accname,
         				'mapid' => $mapid
         			]);

         		return 1;
         	}
		}
	}

	public function deletesubitem(Request $request)
	{
		if($request->ajax())
		{
			$subitemid = $request->get('subitemid');

			$check = db::table('itemclassification')
				->where('glid', $subitemid)
				->count();

			if($check > 0)
			{
				return 0;
			}
			else
			{
				db::table('acc_coa')
					->where('id', $subitemid)
					->update([
						'deleted' => 1,
						'deletedby' => auth()->user()->id,
						'deleteddatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;
			}
		}
	}

	public function loadgroups(Request $request)
	{
		if($request->ajax())
		{
			$groups = FinanceModel::getCOAGroup();

			$grouplist = '<option value="0">Account Type</option>';

			foreach($groups as $group)
			{
				$grouplist .= '
					<option value="'.$group->id.'">'.$group->group.'</option>					
				';
			}

			$data = array(
				'grouplist' => $grouplist
			);

			echo json_encode($data);
		}
	}

	public function deletemapping(Request $request)
	{
		if($request->ajax())
		{
			$mapid = $request->get('mapid');

			$check = db::table('acc_coa')
				->where('mapid', $mapid)
				->count();

			if($check > 0)
			{
				return 0;
			}
			else
			{
				db::table('acc_map')
					->where('id', $mapid)
					->update([
						'deleted' => 1,
						'deleteddatetime' => FinanceModel::getServerDateTime(),
						'deletedby' => auth()->user()->id
					]);

				return 1;
			}
		}
	}

	public function dailycashcollection()
	{
		return view('finance/reports/dailycashcollection');
	}

	public function generateTH(Request $request)
	{
		if($request->ajax())
		{
			
		}
	}

	public function generatereport(Request $request)
	{
		if($request->ajax())
		{
			$terminal = $request->get('terminal');
			$datenow = $request->get('datenow');



			$datearray = array();

			$qdate = date_create($datenow);
			$qdate = date_format($qdate, 'Y-m-d 00:00');
			array_push($datearray, $qdate);
			$qdate = date_create($datenow);
			$qdate = date_format($qdate, 'Y-m-d 23:59');
			array_push($datearray, $qdate);

			$chrngtrans = db::table('chrngtrans')
				// ->select('chrngtrans.*', 'aaa')
				->whereBetween('transdate', $datearray)
				// ->where('ornum', '353585')
				->where('cancelled', 0)
				->orderBy('ornum', 'ASC')
				->get();

			// return $chrngtrans;
			if(count($chrngtrans) > 0)
			{
				$list = '';
				$totalregistration = 0;
				$totalmedical = 0;
				$totalinsurance = 0;
				$totalid = 0;
				$totalsecurityservices = 0;
				$totalidsystem = 0;
				$totaldevelopmentfee = 0;
				$totalannualdues = 0;
				$totaltuition = 0;
				$totalpta = 0;
				$totalbalforward = 0;
				$totalothers = 0;
				$totalcert = 0;
				$totaltotals = 0;
				$totalinternetfee = 0;
				$totalgraduationfee = 0;
				$totaltextbook = 0;
				$grandtotal = 0;

				if(count($chrngtrans) > 0)
				{
					
					foreach($chrngtrans as $trans)
					{

						// FinanceModel::ledgeritemizedreset($trans->studid);
						// FinanceModel::transitemsreset($trans->studid);


						$registration = 0;
						$medical = 0;
						$insurance = 0;
						$id = 0;
						$securityservices = 0;
						$idsystem = 0;
						$developmentfee = 0;
						$annualdues = 0;
						$tuition = 0;
						$pta = 0;
						$balforward = 0;
						$others = 0;
						$cert = 0;
						$totals = 0;
						$internetfee = 0;
						$graduationfee = 0;
						$textbook = 0;


						$chrngtransitems = db::table('chrngtransitems')
							->where('ornum', $trans->ornum)
							->where('deleted', 0)
							->get();
						// echo ' chrngtransitems: ' . $chrngtransitems;

						if(count($chrngtransitems) > 0)
						{
							foreach($chrngtransitems as $item)
							{

								// echo ' ornum: ' . $trans->ornum;

								if($item->itemid == 59)
								{
									$registration += $item->amount;
									$totalregistration += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 61)
								{
									$medical += $item->amount;
									$totalmedical += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 62)
								{
									$insurance += $item->amount;
									$totalinsurance += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 63)
								{
									$id += $item->amount;
									$totalid += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 67)
								{
									$securityservices += $item->amount;
									$totalsecurityservices += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 70)
								{
									$idsystem += $item->amount;
									$totalidsystem += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 86)
								{
									$developmentfee += $item->amount;
									$totaldevelopmentfee += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 65)
								{
									$annualdues += $item->amount;
									$totalannualdues += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 5)
								{
									$pta += $item->amount;
									$totalpta += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 68)
								{
									$internetfee += $item->amount;
									$totalinternetfee += $item->amount;
									$totals += $item->amount;
								}
								elseif($item->itemid == 87)
								{
									$graduationfee += $item->amount;
									$totalgraduationfee += $item->amount;
									$totals += $item->amount;

									// echo ' totalgraduationfee: ' . $totalgraduationfee;
								}
								else
								{


									//Balforward
									$chrngtransdetail = db::table('chrngtransdetail')
										->where('chrngtransid', $trans->id)
										->where('classid', 44)
										->first();

									if($chrngtransdetail)
									{
										$balforward += $chrngtransdetail->amount;
										$totals += $chrngtransdetail->amount;
										$totalbalforward += $chrngtransdetail->amount;
										// $totals += $chrngtransdetail->amount;
										// echo ' -BALANCEFORWARD- ';
										// echo ' totalsbal: ' . $item->amount;
									}
									else
									{

										//TUITION

										// echo ' itemid: ' . $item->itemid;
										// echo ' ornum: ' . $trans->ornum;
										$items = db::table('items')
											// ->select('items.*', 'aaa')
											->where('id', $item->itemid)
											->where(function($q){
												$q->where('description', 'like', '%TUITION%');
												$q->orWhere('description', 'like', '%ENROLLMENT%');
											})
											
											->first();


										if($items)
										{
											$tuition += $item->amount;	
											$totaltuition += $item->amount;
											$totals += $item->amount;
											// echo ' -TUITION- ';
											// echo ' totalstui: ' . $totals;
										}

										//TEXTBOOK
										$items = db::table('items')
											->where('id', $item->itemid)
											->where('description', 'like', '%TEXTBOOK%')
											->first();
										
										if($items)
										{
											$textbook += $item->amount;	
											$totaltextbook += $item->amount;
											$totals += $item->amount;
											// echo ' totalsbk: ' . $totals;
										}
									}
									
								}

								// $totals += $item->amount;
								// echo ' totals: ' . $totals;
							}
						}

						//Cert

						$chrngtransdetail = db::table('chrngtransdetail')
							->where('chrngtransid', $id)
							->where('classid', 56)
							// ->where('payschedid', 77)
							// ->orWhere('chrngtransid', $trans->id)
							// ->where('payschedid', 84)
							->first();

						if($chrngtransdetail)
						{
							$cert += $chrngtransdetail->amount;
							$totals += $chrngtransdetail->amount;
							$totalcert += $chrngtransdetail->amount;
						}
						else
						{
							// //Balforward
							// $chrngtransdetail = db::table('chrngtransdetail')
							// 	->where('chrngtransid', $trans->id)
							// 	->where('classid', 44)
							// 	->first();

							// if($chrngtransdetail)
							// {
							// 	$balforward += $chrngtransdetail->amount;
							// 	$totals += $chrngtransdetail->amount;
							// 	$totalbalforward += $chrngtransdetail->amount;
							// }
							
							$checkTitems = db::table('chrngtransitems')
								->where('ornum', $trans->ornum)
								->where('deleted', 0)
								->count();

							if($checkTitems == 0)
							{
								// echo ' itemid: ' . $item->itemid;
								// echo ' ornum: ' . $trans->ornum;
								$chrngtransdetail = db::table('chrngtransdetail')
									->where('chrngtransid', $trans->id)
									->get();
								
								foreach($chrngtransdetail as $detail)
								{
									$others += $detail->amount;
									$totals += $detail->amount;
									$totalothers += $detail->amount;
									// echo ' -OTHERS- ';
								}
							}
						}

						$grandtotal += $totals;

						$list .='
							<tr>
								<td>'.$trans->ornum.'</td>
								<td>'.$trans->studname.'</td>
								<td class="text-right">'.number_format($registration, 2).'</td>
								<td class="text-right">'.number_format($medical, 2).'</td>
								<td class="text-right">'.number_format($insurance, 2).'</td>
								<td class="text-right">'.number_format($id, 2).'</td>
								<td class="text-right">'.number_format($developmentfee, 2).'</td>
								<td class="text-right">'.number_format($annualdues, 2).'</td>
								<td class="text-right">'.number_format($securityservices, 2).'</td>
								<td class="text-right">'.number_format($pta, 2).'</td>
								<td class="text-right">'.number_format($idsystem, 2).'</td>
								<td class="text-right">'.number_format($internetfee, 2).'</td>
								<td class="text-right">'.number_format($graduationfee, 2).'</td>
								<td class="text-right">'.number_format($tuition, 2).'</td>
								<td class="text-right">'.number_format($textbook, 2).'</td>
								<td class="text-right">'.number_format($balforward, 2).'</td>
								<td class="text-right">'.number_format($cert, 2).'</td>
								<td class="text-right">'.number_format($others, 2).'</td>
								<td class="text-right">'.number_format($totals, 2).'</td>
								
							</tr>
						';
					}
				}


				$data = array(
					'list' => $list,
					'totalregistration' => number_format($totalregistration,2),
					'totalmedical' => number_format($totalmedical,2),
					'totalinsurance' => number_format($totalinsurance,2),
					'totalid' => number_format($totalid,2),
					'totalsecurityservices' => number_format($totalsecurityservices,2),
					'totalidsystem' => number_format($totalidsystem,2),
					'totaldevelopmentfee' => number_format($totaldevelopmentfee,2),
					'totalannualdues' => number_format($totalannualdues,2),
					'totaltuition' => number_format($totaltuition,2),
					'totalpta' => number_format($totalpta,2),
					'totalbalforward' => number_format($totalbalforward,2),
					'totalcert' => number_format($totalcert,2),
					'totalinternetfee' => number_format($totalinternetfee,2),
					'totalgraduationfee' => number_format($totalgraduationfee,2),
					'totaltextbook' => number_format($totaltextbook,2),
					'totalothers' => number_format($totalothers,2),
					'grandtotal' => number_format($grandtotal,2)
				);

				// return view('finance/reports/pdf_dailycashcollection/' . $datenow . '/' . 0)->with($data);
				
				echo json_encode($data);
			}
		}
	}

	public function gendccreport(Request $request)
	{
		if($request->ajax())
		{
			
		}
	}

	public function dailycashsummarypdf($totalregistration, $totalmedical, $totalinsurance, $totalid, $totaldevelopmentfee, $totalannualdues, $totalsecurityservices, $totalpta, $totalidsystem, $totalinternetfee, $totaltuition, $totaltextbook, $totalbalforward, $totalcert, $totalothers, $totaltotals, $grandtotal, $datearray)
	{
		$range = db::table('chrngtrans')
			->select(db::raw('min(ornum) as minOR, max(ornum) as maxOR'))
			->whereBetween('transdate', $datearray)
			->where('cancelled', 0)
			->first();

		$rangeOR = $range->minOR . ' TO ' . $range->maxOR;

		$data = array(
			'totalregistration' => $totalregistration,
			'totalmedical' => $totalmedical,
			'totalinsurance' => $totalinsurance,
			'totalid' => $totalid,
			'totaldevelopmentfee', $totaldevelopmentfee,
			'totalannualdues' => $totalannualdues,
			'totalsecurityservices' => $totalsecurityservices,
			'totalpta' => $totalpta,
			'totalidsystem' => $totalidsystem,
			'totalinternetfee' => $totalinternetfee,
			'totaltuition' => $totaltuition,
			'totaltextbook' => $totaltextbook,
			'totalbalforward' => $totalbalforward,
			'totalcert' => $totalcert,
			'totalothers' => $totalothers,
			'totaltotals' => $totaltotals,
			'grandtotal' => $grandtotal
		);

		$pdf = PDF::loadView('finance/reports/pdf/pdf_dailycashcollectionsummary', $data);
		return $pdf->stream('dailycashcollection.pdf'); 
	}


	public function dailycashcollectionpdf($date, $terminal, $action)
	{
		$datenow = date_create($date);
		// return $date;
		$datenow = date_format($datenow, 'F d, Y');


		$datearray = array();

		$qdate = date_create($datenow);
		$qdate = date_format($qdate, 'Y-m-d 00:00');
		array_push($datearray, $qdate);
		$qdate = date_create($datenow);
		$qdate = date_format($qdate, 'Y-m-d 23:59');
		array_push($datearray, $qdate);

		$chrngtrans = db::table('chrngtrans')
			->whereBetween('transdate', $datearray)
			->where('cancelled', 0)
			->orderBy('ornum', 'ASC')
			->get();

		$range = db::table('chrngtrans')
			->select(db::raw('min(ornum) as minOR, max(ornum) as maxOR'))
			->whereBetween('transdate', $datearray)
			->where('cancelled', 0)
			->first();

		$rangeOR = $range->minOR . ' TO ' . $range->maxOR;

		// return $chrngtrans;

		$list = array();
		$totalregistration = 0;
		$totalmedical = 0;
		$totalinsurance = 0;
		$totalid = 0;
		$totalsecurityservices = 0;
		$totalidsystem = 0;
		$totaldevelopmentfee = 0;
		$totalannualdues = 0;
		$totaltuition = 0;
		$totalpta = 0;
		$totalbalforward = 0;
		$totalothers = 0;
		$totalcert = 0;
		$totaltotals = 0;
		$totalinternetfee = 0;
		$totalgraduationfee = 0;
		$totaltextbook = 0;
		$grandtotal = 0;

		if(count($chrngtrans) > 0)
		{
			
			foreach($chrngtrans as $trans)
			{


				$registration = 0;
				$medical = 0;
				$insurance = 0;
				$id = 0;
				$securityservices = 0;
				$idsystem = 0;
				$developmentfee = 0;
				$annualdues = 0;
				$tuition = 0;
				$pta = 0;
				$balforward = 0;
				$others = 0;
				$cert = 0;
				$totals = 0;
				$internetfee = 0;
				$graduationfee = 0;
				$textbook = 0;
				


				$chrngtransitems = db::table('chrngtransitems')
					->where('ornum', $trans->ornum)
					->where('deleted', 0)
					->get();
				// return $chrngtransitems;

				if(count($chrngtransitems) > 0)
				{
					foreach($chrngtransitems as $item)
					{

						if($item->itemid == 59)
						{
							$registration += $item->amount;
							$totalregistration += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 61)
						{
							$medical += $item->amount;
							$totalmedical += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 62)
						{
							$insurance += $item->amount;
							$totalinsurance += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 63)
						{
							$id += $item->amount;
							$totalid += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 67)
						{
							$securityservices += $item->amount;
							$totalsecurityservices += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 70)
						{
							$idsystem += $item->amount;
							$totalidsystem += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 86)
						{
							$developmentfee += $item->amount;
							$totaldevelopmentfee += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 65)
						{
							$annualdues += $item->amount;
							$totalannualdues += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 5)
						{
							$pta += $item->amount;
							$totalpta += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 68)
						{
							$internetfee += $item->amount;
							$totalinternetfee += $item->amount;
							$totals += $item->amount;
						}
						elseif($item->itemid == 87)
						{
							$graduationfee += $item->amount;
							$totalgraduationfee += $item->amount;
							$totals += $item->amount;
						}
						else
						{

							//Balforward
							$chrngtransdetail = db::table('chrngtransdetail')
								->where('chrngtransid', $trans->id)
								->where('classid', 44)
								->first();

							if($chrngtransdetail)
							{
								$balforward += $chrngtransdetail->amount;
								$totals += $chrngtransdetail->amount;
								$totalbalforward += $chrngtransdetail->amount;
								// $totals += $chrngtransdetail->amount;
								// echo ' -BALANCEFORWARD- ';
								// echo ' totalsbal: ' . $item->amount;
							}
							else
							{
								//TUITION
								$items = db::table('items')
									// ->select('items.*', 'aaa')
									->where('id', $item->itemid)
									->where(function($q){
										$q->where('description', 'like', '%TUITION%');
										$q->orWhere('description', 'like', '%ENROLLMENT%');
									})
									
									->first();


								if($items)
								{
									$tuition += $item->amount;	
									$totaltuition += $item->amount;
									$totals += $item->amount;
								}


								$items = db::table('items')
									->where('id', $item->itemid)
									->where('description', 'like', '%TEXTBOOK%')
									->first();
								
								if($items)
								{
									$textbook += $item->amount;	
									$totaltextbook += $item->amount;
									$totals += $item->amount;
								}
							}
							
						}


						// $totals += $item->amount;
					}
				}

				//Cert

				$chrngtransdetail = db::table('chrngtransdetail')
					->where('chrngtransid', $trans->id)
					->where('payschedid', 77)
					->first();

				if($chrngtransdetail)
				{
					$cert += $chrngtransdetail->amount;
					$totals += $chrngtransdetail->amount;
					$totalcert += $chrngtransdetail->amount;
				}
				else
				{

					// $chrngtransdetail = db::table('chrngtransdetail')
					// 	->where('chrngtransid', $trans->id)
					// 	->where('classid', 44)
					// 	->first();

					// if($chrngtransdetail)
					// {
					// 	$balforward += $chrngtransdetail->amount;
					// 	$totals += $chrngtransdetail->amount;
					// 	$totalbalforward += $chrngtransdetail->amount;
					// }
				
					$checkTitems = db::table('chrngtransitems')
						->where('ornum', $trans->ornum)
						->where('deleted', 0)
						->count();

					if($checkTitems == 0)
					{
						$chrngtransdetail = db::table('chrngtransdetail')
							->where('chrngtransid', $trans->id)
							->get();
						
						foreach($chrngtransdetail as $detail)
						{
							$others += $detail->amount;
							$totals += $detail->amount;
							$totalothers += $detail->amount;
						}
					}
					
				}

				$grandtotal += $totals;

				array_push($list, (object)[
					'ornum' => $trans->ornum,
					'studname' => $trans->studname,
					'registration' => number_format($registration, 2),
					'medical' => number_format($medical, 2),
					'insurance' => number_format($insurance, 2),
					'id' => number_format($id, 2),
					'developmentfee' => number_format($developmentfee, 2),
					'annualdues' => number_format($annualdues, 2),
					'securityservices' => number_format($securityservices, 2),
					'pta' => number_format($pta, 2),
					'idsystem' => number_format($idsystem, 2),
					'internetfee' => number_format($internetfee, 2),
					'graduationfee' => number_format($graduationfee, 2),
					'tuition' => number_format($tuition, 2),
					'textbook' => number_format($textbook, 2),
					'balforward' => number_format($balforward, 2),
					'cert' => number_format($cert, 2),
					'others' => number_format($others, 2),
					'totals' => number_format($totals, 2)
				]);




				// $list .='
				// 	// <tr>
				// 	// 	<td>'.$trans->ornum.'</td>
				// 	// 	<td>'.$trans->studname.'</td>
				// 	// 	<td class="text-right">'.number_format($registration, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($medical, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($insurance, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($id, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($developmentfee, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($annualdues, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($securityservices, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($pta, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($idsystem, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($internetfee, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($tuition, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($textbook, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($balforward, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($cert, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($others, 2).'</td>
				// 	// 	<td class="text-right">'.number_format($totals, 2).'</td>
						
				// 	// </tr>
				// ';
			}
		}


		$data = array(
			'list' => $list,
			'totalregistration' => number_format($totalregistration,2),
			'totalmedical' => number_format($totalmedical,2),
			'totalinsurance' => number_format($totalinsurance,2),
			'totalid' => number_format($totalid,2),
			'totalsecurityservices' => number_format($totalsecurityservices,2),
			'totalidsystem' => number_format($totalidsystem,2),
			'totaldevelopmentfee' => number_format($totaldevelopmentfee,2),
			'totalannualdues' => number_format($totalannualdues,2),
			'totaltuition' => number_format($totaltuition,2),
			'totalpta' => number_format($totalpta,2),
			'totalbalforward' => number_format($totalbalforward,2),
			'totalcert' => number_format($totalcert,2),
			'totalinternetfee' => number_format($totalinternetfee,2),
			'totalgraduationfee' => number_format($totalgraduationfee,2),
			'totaltextbook' => number_format($totaltextbook,2),
			'totalothers' => number_format($totalothers,2),
			'grandtotal' => number_format($grandtotal,2),
			'datenow' => $datenow,
			'rangeOR' => $rangeOR
		);

















		// $data = array(
		// 	'datenow' => $datenow
		// );

		// return view('finance/reports/pdf/pdf_dailycashcollection')->with($data);


		if($action == 'List')
		{
			$pdf = PDF::loadView('finance/reports/pdf/pdf_dailycashcollection', $data);
			return $pdf->stream('dailycashcollection.pdf');
		}
		else
		{
			$pdf = PDF::loadView('finance/reports/pdf/pdf_dailycashcollectionsummary', $data);
			return $pdf->stream('dailycashcollection.pdf');	
		}
	}


	public function distitemamount(Request $request)
	{
		if($request->ajax())
		{

			$chrngtrans = db::table('chrngtrans')
				->select('chrngtransid', 'chrngtransdetail.id as chrngtransdetailid', 'ornum', 'classid', 'chrngtransdetail.amount', 'studid', 'syid', 'semid')
				->join('chrngtransdetail', 'chrngtrans.id', '=', 'chrngtransdetail.chrngtransid')
				->where('cancelled', 0)
				->where('posted', 1)
				// ->where('ornum', '353570')
				->get();
			// return $chrngtrans;

			foreach($chrngtrans as $trans)
			{

				$transamount = $trans->amount;


				top:

				$ledgeritemized = db::select(
					'SELECT *
					FROM `studledgeritemized` 
					WHERE `studid` = ? 
						AND `syid` = ? 
						AND `semid` = ? 
						AND `classificationid` =? 
						AND `deleted` = 0
						AND `totalamount` < itemamount', [$trans->studid, $trans->syid, $trans->semid, $trans->classid]
				);

				// if(count($ledgeritemized) == 0)
				// {
				// 	$ledgeritemized = db::select(
				// 		'SELECT *
				// 		FROM `studledgeritemized` 
				// 		WHERE `studid` = ? 
				// 			AND `syid` = ? 
				// 			AND `semid` = ? 
				// 			AND `totalamount` < itemamount', [$trans->studid, $trans->syid, $trans->semid]
				// 	);
				// }

				if(count($ledgeritemized) == 0)
				{
					$transamount = 0;
				}

				// return $ledgeritemized;

				foreach($ledgeritemized as $item)
				{
					// echo ' transamount: ' . $transamount . '; itemid: ' . $item->itemid . ' classid: ' . $trans->classid;

					if($transamount > 0)
					{
						// echo ' transamount: ' . $transamount . '; itemid: ' . $item->itemid . ' classid: ' . $trans->classid;
						$checkitem = db::table('studledgeritemized')
							->where('id', $item->id)
							->first();

						// echo $checkitem->totalamount . ' < ' . $item->itemamount . '; ';
						if($checkitem)
						{
							if($checkitem->totalamount < $item->itemamount)
							{
								$_getamount = $item->itemamount - $item->totalamount;

								if($transamount >= $_getamount)
								{
									db::table('studledgeritemized')
										->where('id', $item->id)
										->update([
											'totalamount' => $item->totalamount + $_getamount,
											'updatedby' => auth()->user()->id,
											'updateddatetime' => FinanceModel::getServerDateTime()
										]);


									db::table('chrngtransitems')
										->insert([
											'chrngtransid' => $trans->chrngtransid,
											'chrngtransdetailid' => $trans->chrngtransdetailid,
											'ornum' => $trans->ornum,
											'itemid' => $item->itemid,
											'classid' => $item->classificationid,
											'amount' => $_getamount,
											'studid' => $item->studid,
											'syid' => $trans->syid,
											'semid' => $trans->semid,
											'createdby' => auth()->user()->id,
											'createddatetime' => FinanceModel::getServerDateTime()
										]);


									$transamount -= $_getamount;

								}
								else
								{
									db::table('studledgeritemized')
										->where('id', $item->id)
										->update([
											'totalamount' => $item->totalamount + $transamount,
											'updatedby' => auth()->user()->id,
											'updateddatetime' => FinanceModel::getServerDateTime()
										]);

									db::table('chrngtransitems')
										->insert([
											'chrngtransid' => $trans->chrngtransid,
											'chrngtransdetailid' => $trans->chrngtransdetailid,
											'ornum' => $trans->ornum,
											'itemid' => $item->itemid,
											'classid' => $item->classificationid,
											'amount' => $transamount,
											'studid' => $item->studid,
											'syid' => $trans->syid,
											'semid' => $trans->semid,
											'createdby' => auth()->user()->id,
											'createddatetime' => FinanceModel::getServerDateTime()
										]);

									$transamount = 0;
								}
		
							}
						}
					}
				}

				// return $transamount;

				if($transamount > 0)
				{
					goto top;
				}

			}





			// GENERATE STUDLEDGER ITEMIZED

			// $chrngtrans = db::table('chrngtrans')
			// 	->select('chrngtransdetail.*', 'studid')
			// 	->join('chrngtransdetail', 'chrngtrans.id', '=', 'chrngtransdetail.chrngtransid')
			// 	->where('chrngtrans.cancelled', 0)
			// 	->get();


			// $studinfo = db::table('studinfo')
			// 	->where('studstatus', '!=', 0)
			// 	->where('deleted', 0)
			// 	->get();


			// foreach($studinfo as $stud)
			// {
			// 	$tuitions = db::table('tuitionheader')
			// 		->select('syid', 'semid', 'grantee', 'tuitiondetail.id as detailid', 'tuitionitems.id as tuitionitemid', 'classificationid', 'itemid', 'tuitionitems.amount')
			// 		->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
			// 		->join('tuitionitems', 'tuitiondetail.id', '=', 'tuitionitems.tuitiondetailid')
			// 		->where('tuitionheader.deleted', 0)
			// 		->where('tuitiondetail.deleted', 0)
			// 		->where('tuitionitems.deleted', 0)
			// 		->where('levelid', $stud->levelid)
			// 		->where('grantee', $stud->grantee)
			// 		->where('syid', FinanceModel::getSYID())
			// 		->where('semid', FinanceModel::getSemID())
			// 		->get();

			// 	if(count($tuitions) == 0)
			// 	{
			// 		$tuitions = db::table('tuitionheader')
			// 			->select('syid', 'semid', 'grantee', 'tuitiondetail.id as detailid', 'tuitionitems.id as tuitionitemid', 'classificationid', 'itemid', 'tuitionitems.amount')
			// 			->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
			// 			->join('tuitionitems', 'tuitiondetail.id', '=', 'tuitionitems.tuitiondetailid')
			// 			->where('tuitionheader.deleted', 0)
			// 			->where('tuitiondetail.deleted', 0)
			// 			->where('tuitionitems.deleted', 0)
			// 			->where('levelid', $stud->levelid)
			// 			->where('syid', FinanceModel::getSYID())
			// 			->where('semid', FinanceModel::getSemID())
			// 			->get();
			// 	}

			// 	foreach($tuitions as $tuition)
			// 	{
			// 		db::table('studledgeritemized')
			// 			->insert([
			// 				'studid' => $stud->id,
			// 				'syid' => FinanceModel::getSYID(),
			// 				'semid' => FinanceModel::getSemID(),
			// 				'tuitiondetailid' => $tuition->detailid,
			// 				'classificationid' => $tuition->classificationid,
			// 				'tuitionitemid' => $tuition->tuitionitemid,
			// 				'itemAmount' => $tuition->amount,
			// 				'itemid' => $tuition->itemid,
			// 				'deleted' => 0
			// 			]); 
			// 	}
			// }
		}
	}

	public function saveDCR(Request $request)
	{
		if($request->ajax())
		{

		}
	}

	public function seladdstud(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			$studinfo = db::table('studinfo')
				->select('studinfo.id', 'lrn', 'sid', 'lastname', 'firstname', 'middlename', 'suffix', 'grantee.description as grantee', 'levelname')
				->join('gradelevel', 'studinfo.levelid', '=' , 'gradelevel.id')
				->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
				->where('studinfo.id', $studid)
				->first();

			$list = '';
			$studname = $studinfo->lastname . ', ' . $studinfo->firstname . ' ' . $studinfo->middlename .  ' ' . $studinfo->suffix;
			$list .='
				<tr data-id="'.$studinfo->id.'">
					<td data-id="'.$studinfo->sid.'">'.$studinfo->lrn.'</td>
					<td>'.strtoUpper($studname).'</td>
					<td>'.$studinfo->levelname.'</td>
					<td>'.$studinfo->grantee.'</td>
					<td><button class="btn btn-danger btn-del btn-sm" data-id="'.$studinfo->id.'"><i class="far fa-trash-alt"></i></button></td>
				</tr>
			';

			$data = array(
				'list' => $list
			);

			echo json_encode($data);

		}
	}

	public function loadfees(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');

			$stud = db::table('studinfo')
				->where('id', $studid)
				->first();

			$levelid = $stud->levelid;

			$tuitionheader = db::table('tuitionheader')
				->select(db::raw('tuitionheader.id, tuitionheader.`description`, tuitionheader.levelid, grantee.`description` AS grantee, SUM(amount) AS amount'))
				->join('studinfo', 'tuitionheader.levelid', '=', 'studinfo.levelid')
				->join('grantee', 'tuitionheader.grantee', '=', 'grantee.id')
				->join('tuitiondetail', 'tuitionheader.id', '=', 'tuitiondetail.headerid')
				->where('studinfo.id', $studid)
				->where('tuitionheader.deleted', 0)
				->where('tuitiondetail.deleted', 0)
				->where('tuitionheader.syid', $syid)
				->where(function($q) use($levelid, $semid){
					if($levelid == 14 || $levelid == 15)
    				{
    					if($semid == 3)
    					{
    						$q->where('tuitionheader.semid', $semid);
    					}
    					else
    					{
    						if(FinanceModel::shssetup() == 0)
	    					{
	    						$q->where('tuitionheader.semid', $semid);
	    					}
    					}
	    					
    				}
    				elseif($levelid >= 17 && $levelid <= 21)
    				{
    					$q->where('tuitionheader.semid', $semid);
    				}
    				else
    				{
    					if($semid == 3)
    					{
    						$q->where('tuitionheader.semid', $semid);
    					}
    					else
    					{
    						$q->where('tuitionheader.semid', '!=', 3);
    					}
    				}
				})
				->groupBy('tuitiondetail.headerid')
				->orderBy('tuitionheader.description', 'ASC')
				->get();

			$list = '';


			foreach($tuitionheader as $thead)
			{
				$list .='
					<div class="col-md-4 col-fees" data-id="'.$thead->id.'">
		              	<div class="card" style="cursor: pointer">
							<div class="card-header bg-info text-bold">
								'.$thead->description.'
							</div>  
							<div class="card-body">
								<span class="text-bold">GRANTEE<span>: <span>'.$thead->grantee.'</span><br>
								<span class="text-bold">AMOUNT</span>: <span>'.number_format($thead->amount, 2).'</span>
							</div>
						</div>
		            </div>  
				';
			}

			$data = array(
				'feelist' => $list
			);

			echo json_encode($data);
		}
	}
	
	public function togglepayplan(Request $request)
	{
		if($request->ajax())
		{
			$status = $request->get('status');

			db::table('schoolinfo')
				->update([
					'paymentplan' => $status
				]);
		}
	}

	public function exampermit()
	{
		return view('finance/exampermit');
	}

	public function permit_studfilter(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$ispercent = $request->get('ispercent');
			$lessthanamount = str_replace(',', '', $request->get('lessthanamount'));
			$allow = $request->get('allow');
			$searchstud = $request->get('searchstud');
			$courseid = $request->get('courseid');
			$qactive = db::table('quarter_setup')->where('isactive', 1)->first()->id;


			$studinfo = db::table('studinfo')
				->select('studinfo.id', 'sid', 'lastname', 'firstname', 'middlename', 'levelname', 'allowtoexam')
				->join('gradelevel', 'studinfo.levelid', 'gradelevel.id')
				->where('levelid', $levelid)
				->where('studstatus', '>', 0)
				->where('studinfo.deleted', 0)
				->where(function($q) use($searchstud){
					$q->where('lastname', 'like', '%'.$searchstud.'%');
					$q->orWhere('firstname', 'like', '%'.$searchstud.'%');
					$q->orWhere('sid', 'like', '%'.$searchstud.'%');
				})
				->where(function($q) use($courseid, $levelid){
					if($levelid >= 17 && $levelid <= 21)
					{
						$q->where('courseid', $courseid);
					}
				})
				->orderBy('sortid', 'ASC')
				->orderBy('lastname', 'ASC')
				->orderBy('firstname', 'ASC')
				->get();

			// return $studinfo;

			$monthnow = date_create(FinanceModel::getServerDateTime());
			$monthnow = date_format($monthnow, 'm');
			
			$payschedlist ='';
			$studlist ='';
			$studcount = count($studinfo);
			$echoarray = array();
			

			foreach($studinfo as $stud)
			{
				$duedate = 0;
				$payschedlist = '';

				$name = $stud->sid . ' - ' . $stud->lastname . ', ' . $stud->firstname . ' ' . $stud->middlename;

				$getPaySched = db::select('select sum(amount) as amountdue, sum(amountpay) as amountpay, sum(balance) as balance, duedate, studid
		            from studpayscheddetail
		            where studid = ? and syid = ? and semid = ? and deleted = 0 and amount > 0
		            group by MONTH(duedate)
		            order by duedate', [$stud->id, FinanceModel::getSYID(), FinanceModel::getSemID()]);

				$balance = 0;

				foreach ($getPaySched as $paysched)
				{
					if($paysched->duedate != '')
					{
						$due = date_create($paysched->duedate);
						$duedate = date_format($due, 'm');
						$f = date_format($due, 'F');
					}

					// echo $stud->id . ' - ' . $duedate. '; ';

					if($paysched->duedate != '')
					{
						$particulars = 'TUITION/BOOKS/OTH FEE - ' . $f;
					}
					else
					{
						$particulars = 'TUITION/BOOKS/OTH FEE';
					}

					// echo $monthnow . ' != ' . $duedate . '; ';

					if($monthnow != $duedate)
					{
						$payschedlist .='
							<tr>
			                	<td>'.$particulars.'</td>
			                  	<td class="text-right">'.number_format($paysched->amountdue, 2).'</td>
			                  	<td class="text-right">'.number_format($paysched->amountpay, 2).'</td>
			                  	<td class="text-right">'.number_format($paysched->balance, 2).'</td>
			                </tr>
						';

						$balance += $paysched->balance;
					}
					else
					{
						$payschedlist .='
							<tr>
			                	<td>'.$particulars.'</td>
			                  	<td class="text-right">'.number_format($paysched->amountdue, 2).'</td>
			                  	<td class="text-right">'.number_format($paysched->amountpay, 2).'</td>
			                  	<td class="text-right">'.number_format($paysched->balance, 2).'</td>
			                </tr>
						';

						$balance += $paysched->balance;
						
						goto done;	
					}

				}

				done:
				// return $lessthanamount;

				$permittedcount = db::table('permittoexam')
					->where('studid', $stud->id)
					->where('syid', FinanceModel::getSYID())
					->where('semid', FinanceModel::getSemID())
					->where('deleted', 0)
					->where('quarterid', $qactive)
					->count();
				// return $permittedcount;
				if($lessthanamount != '')
				{	
					if($balance <= $lessthanamount)
					{
						if($allow == 0)
						{
							if($balance > 0 && $permittedcount == 0)
							{
								$studlist .='
									<tr data-id="'.$stud->id.'">
										<td>'.$name.'</td>
										<td style="width:82px">'.$stud->levelname.'</td>
										<td class="text-right">'.number_format($balance, 2).'</td>
										<td class="text-center"><button class="btn btn-success btn-sm btn-permit" data-id="'.$stud->id.'" style="width: 111px !important">Permit</button></td>
									</tr>
								';
											
							}
						}
						else
						{
							if($balance == 0 || $permittedcount  > 0)
							{
								$studlist .='
									<tr data-id="'.$stud->id.'">
										<td>'.$name.'</td>
										<td style="width:82px">'.$stud->levelname.'</td>
										<td class="text-right">'.number_format($balance, 2).'</td>
										<td></td>
									</tr>
								';
							}
						}
					}
				}
				else
				{
					if($allow == 0)
					{
						if($balance > 0 && $permittedcount == 0)
						{
							$studlist .='
								<tr data-id="'.$stud->id.'">
									<td>'.$name.'</td>
									<td style="width:82px">'.$stud->levelname.'</td>
									<td class="text-right">'.number_format($balance, 2).'</td>
									<td class="text-center"><button class="btn btn-success btn-sm btn-permit" data-id="'.$stud->id.'" style="width: 111px !important">Permit</button></td>
								</tr>
							';
										
						}
					}
					else
					{
						if($balance == 0 || $permittedcount  > 0)
						{
							$studlist .='
								<tr data-id="'.$stud->id.'">
									<td>'.$name.'</td>
									<td style="width:82px">'.$stud->levelname.'</td>
									<td class="text-right">'.number_format($balance, 2).'</td>
									<td></td>
								</tr>
							';
						}
					}
				}

				

			}

			// return $echoarray;

			$data = array(
				'studlist' => $studlist,
				'payschedlist' => $payschedlist,
			);

			echo json_encode($data);



		}
	}

	public function permit_allowtoexam(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$qactive = db::table('quarter_setup')->where('isactive', 1)->first()->id;

			// db::table('studinfo')
			// 	->where('id', $studid)
			// 	->update([
			// 		'allowtoexam' => 1,
			// 		'allowdate' => FinanceModel::getServerDateTime(),
			// 		'allowtoexamby' => auth()->user()->id
			// 	]);

			$permittoexam = db::table('permittoexam')
				->where('studid', $studid)
				->where('syid', FinanceModel::getSYID())
				->where('semid', FinanceModel::getSemID())
				->where('quarterid', $qactive)
				->count();


			if($permittoexam == 0)
			{
				db::table('permittoexam')
					->insert([
						'studid' => $studid,
						'quarterid' => $qactive,
						'syid' => FinanceModel::getSYID(),
						'semid' => FinanceModel::getSemID(),
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}

		}
	}

	public function permit_loadinfo(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			$balance = 0;
			$payment = 0;
			$amount = 0;
			$totalpayment = 0;
			$totalamount = 0;
			$ledgerlist = '';
			$assessmentlist = '';

			
			//load ledger
			$studledger = db::table('studledger')
				->where('studid', $studid)
				->where('deleted', 0)
				->where('syid', FinanceModel::getSYID())
				->where('semid', FinanceModel::getSemID())
				->where('void', 0)
				->get();

			foreach($studledger as $ledger)
			{
				$date = date_create($ledger->createddatetime);
				$date = date_format($date, 'm-d-Y');

				$balance += $ledger->amount - $ledger->payment;
				$totalamount += $ledger->amount;
				$totalpayment += $ledger->payment;

				if($ledger->amount > 0)
				{
					$amount = number_format($ledger->amount, 2);
				}
				else
				{
					$amount = '';	
				}

				if($ledger->payment > 0)
				{
					$payment = number_format($ledger->payment, 2);
				}
				else
				{
					$payment = '';	
				}

				$ledgerlist .='
					<tr>
						<td style="width:102px">'.$date.'</td>
						<td>'.$ledger->particulars.'</td>
						<td class="text-right">'.$amount.'</td>
						<td class="text-right">'.$payment.'</td>
						<td class="text-right">'.number_format($balance, 2).'</td>
					</tr>
				';
			}

			$ledgerlist .='
				<tr>
					<td colspan="2" class="text-right">TOTAL:</td>
					<td class="text-right text-bold text-md">'.number_format($totalamount, 2).'</td>
					<td class="text-right text-bold text-md">'.number_format($totalpayment, 2).'</td>
					<td class="text-right text-bold text-md">'.number_format($balance, 2).'</td>
				</tr>
			';

			$monthnow = date_create(FinanceModel::getServerDateTime());
			$monthnow = date_format($monthnow, 'm');
			$duedate =0;
			$payschedlist ='';

			$schedamount = 0;
			$schedpayment = 0;
			$schedbalance = 0;

			$getPaySched = db::select('select sum(amount) as amountdue, sum(amountpay) as amountpay, sum(balance) as balance, duedate, studid
	            from studpayscheddetail
	            where studid = ? and syid = ? and semid = ? and deleted = 0 and amount > 0
	            group by MONTH(duedate)
	            order by duedate', [$studid, FinanceModel::getSYID(), FinanceModel::getSemID()]);

			foreach ($getPaySched as $paysched)
			{
				if($paysched->duedate != '')
				{
					$due = date_create($paysched->duedate);
					$duedate = date_format($due, 'm');
					$f = date_format($due, 'F');
				}

				$schedamount += $paysched->amountdue;
				$schedpayment += $paysched->amountpay;
				$schedbalance += $paysched->balance;

				if($paysched->duedate != '')
				{
					$particulars = 'TUITION/BOOKS/OTH FEE - ' . $f;
				}
				else
				{
					$particulars = 'TUITION/BOOKS/OTH FEE';
				}

				// echo $monthnow . ' != ' . $duedate . '; ';

				if($monthnow != $duedate)
				{
					$payschedlist .='
						<tr>
		                	<td>'.$particulars.'</td>
		                  	<td class="text-right">'.number_format($paysched->amountdue, 2).'</td>
		                  	<td class="text-right">'.number_format($paysched->amountpay, 2).'</td>
		                  	<td class="text-right">'.number_format($paysched->balance, 2).'</td>
		                </tr>
					';

					$balance += $paysched->balance;
				}
				else
				{
					$payschedlist .='
						<tr>
		                	<td>'.$particulars.'</td>
		                  	<td class="text-right">'.number_format($paysched->amountdue, 2).'</td>
		                  	<td class="text-right">'.number_format($paysched->amountpay, 2).'</td>
		                  	<td class="text-right">'.number_format($paysched->balance, 2).'</td>
		                </tr>
					';

					$balance += $paysched->balance;
					
					goto done;	
				}

			}

			done:

			$payschedlist .='
				<tr>
                	<td class="text-right">TOTAL: </td>
                  	<td class="text-right text-bold text-md">'.number_format($schedamount, 2).'</td>
                  	<td class="text-right text-bold text-md">'.number_format($schedpayment, 2).'</td>
                  	<td class="text-right text-bold text-md">'.number_format($schedbalance, 2).'</td>
                </tr>
			';


			$data = array(
				'ledgerlist' => $ledgerlist,
				'assessmentlist' => $payschedlist
			);

			echo json_encode($data);
		}
	}

	// public function permit_loadsetup(Request $request)
	// {
	// 	if($request->ajax())
	// 	{
	// 		$qsetup = db::table('quarter_setup')		
	// 			->where('deleted', 0)
	// 			->get();

	// 		$qlist = '';
	// 		$qactive = '';

	// 		foreach($qsetup as $q)
	// 		{

	// 			if($q->isactive == 1)
	// 			{
	// 				$qactive = '<span class="text-center text-success">ACTIVE</span>';
	// 			}
	// 			else
	// 			{
	// 				$qactive = '<span class="text-center text-danger">NOT ACTIVE</span>';
	// 			}

	// 			$qdate = '';

	// 			// if($q->quarterdate != null)
	// 			// {
	// 			// 	$qdate = date_create($q->quarterdate);
	// 			// 	$qdate = date_format($qdate, 'F');
	// 			// }
	// 			// else
	// 			// {
	// 			// 	$qdate = '';
	// 			// }

	// 			$monthsetup = db::table('monthsetup')
	// 				->get();

	// 			$msetup = '';
	// 			foreach($monthsetup as $month)
	// 			{
	// 				$msetup .='
	// 					<option value="'.$month->description.'">'.$month->description.'</option>
	// 				';
	// 			}

	// 			$qlist .='
	// 				<div class="card collapsed-card mb-1 card-headActive" style="border: 1px solid #ddd; box-shadow:none !important">
	// 					<div class="card-header">
	// 						<button type="button" class="btn btn-tool text-primary btn-block" data-card-widget="collapse"> 
	// 							<div class="row">
	// 								<div class="col-md-5 text-bold text-left">'.$q->description.'</div>
	// 								<div class="col-md-3">'.$qdate.'</div>
	// 								<div class="col-md-3">'.$qactive.'</div>
	// 								<div class="col-md-1">
	// 								</div>
	// 							</div>
	// 						</button>
	// 					</div>
	// 					<div class="card-body" style="display: none;">
	// 				   		<div class="row">
	// 				   			<div class="col-md-5">
	// 				   				<label>Description</label>
	// 				   				<input type="text" data-id="'.$q->id.'" class="form-control" value="'.$q->description.'">
	// 				   			</div>
	// 				   			<div col-md-3>
	// 				   				<label>Month</label>
	// 				   				<select class="select2bs4 form-control">
	// 				   					'.$msetup.'
	// 				   				</select>
	// 				   			</div>
	// 				   			<div col-md-3>
	// 				   				<button data-id="'.$q->id.'" class="btn btn-primary btn-sm ml-3" style="margin-top:35px">Save</button>
	// 				   			</div>
	// 				   		</div>
	// 				  	</div>
	// 				</div>
	// 			';

				

	// 			// $qlist .='
	// 			// 	<tr data-id="'.$q->id.'">
	// 			// 		<td>'.$q->description.'</td>
	// 			// 		<td>'.$qdate.'</td>
	// 			// 		<td class="text-center">
	// 			// 			'.$qactive.'
	// 			// 		</td>
	// 			// 	</tr>
	// 			// ';
	// 		}

	// 		$data = array(
	// 			'qlist' => $qlist
	// 		);

	// 		echo json_encode($data);
	// 	}
	// }

	public function permit_loadsetup(Request $request)
	{
		if($request->ajax())
		{
			$quartersetup = db::table('quarter_setup')
				->where('deleted', 0)
				->get();

			// return $quartersetup;


			$qlist = '';

			foreach($quartersetup as $setup)
			{
				if($setup->isactive == 1)
				{
					$qlist .='
						<tr id="'.$setup->id.'">
							<td>'.$setup->description.'</td>
							<td>
								<span data-id="'.$setup->id.'" class="btn btn-success btn-block activate" disabled>ACTIVE</span>
							</td>
						</tr>
					';
				}
				else
				{
					$qlist .='
						<tr>
							<td>'.$setup->description.'</td>
							<td>
								<span data-id="'.$setup->id.'" class="btn btn-secondary btn-block activate">ACTIVATE</span>
							</td>
						</tr>
					';
				}
			}

			$data = array(
				'qlist' => $qlist
			);

			echo json_encode($data);
		}
	}

	public function permit_activequarter(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			// $val = $request->get('val');

			db::table('quarter_setup')
				->update([
					'isactive' => 0
				]);


			db::table('quarter_setup')
				->where('id', $dataid)
				->update([
					'isactive' => 1,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

		}
	}
	
	public function dpv2(Request $request)
	{
		return view('finance/dpv2');
	}
	
	public function dpv2_loadclass(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			
			$option = '<option value="0">Select Classification</option>';

			$tuitionheader = db::table('tuitionheader')
				->where('levelid', $levelid)
				->where('syid', $syid)
				->where(function($q) use($levelid, $semid){
					if($levelid == 14 || $levelid == 15)
					{
						if(db::table('schoolinfo')->first()->shssetup == 0)
						{
							$q->where('semid', $semid);
						}
					}
					if($levelid >= 17 && $levelid <= 20)
					{
						$q->where('semid', $semid);
					}
				})
				->where('grantee', 1)
				->where('deleted', 0)
				->first();

			if(!$tuitionheader)
			{
				$tuitionheader = db::table('tuitionheader')
					->where('levelid', $levelid)
					->where('deleted', 0)
					->first();				
			}

			if($tuitionheader)
			{
				$tuitiondetail = db::table('tuitiondetail')
					->select(db::raw('`tuitiondetail`.`id`, `itemclassification`.`description`'))
					->join('itemclassification', 'tuitiondetail.classificationid', '=', 'itemclassification.id')
					->where('headerid', $tuitionheader->id)
					->where('tuitiondetail.deleted', 0)
					->get();

				foreach($tuitiondetail as $detail)
				{
					$option .='
						<option value="'.$detail->id.'">'.$detail->description.'</option>
					';
				}
			}

			$data = array(
				'list' => $option
			);

			echo json_encode($data);

		}
	}

	public function dpv2_loadclassitems(Request $request)
	{
		if($request->ajax())
		{
			$detailid = $request->get('detailid');
			$list = '';
			$total = 0;
			
			$tuitionitems = db::table('tuitionitems')
				->select('items.description', 'tuitionitems.id', 'itemid', 'tuitionitems.amount')
				->join('items', 'tuitionitems.itemid', '=', 'items.id')
				->where('tuitiondetailid', $detailid)
				->where('tuitionitems.deleted', 0)
				->get();

			foreach($tuitionitems as $item)
			{
				$list .='
					<tr data-id="'.$item->id.'" item-id="'.$item->itemid.'" data-amount="'.$item->amount.'">
						<td>'.$item->description.'</td>
						<td class="text-right">'.number_format($item->amount, 2).'</td>
					</tr>
				';

				$total += $item->amount;
			}

			$data = array(
				'list' => $list,
				'total' => number_format($total, 2)
			);

			echo json_encode($data);

		}
	}

	public function dpv2_appenddpitem(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$levelid = $request->get('levelid');
			$tuitiondetailid = $request->get('classid');
			$itemid = $request->get('itemid');
			$amount = $request->get('amount');
			$description = $request->get('description');
			$syid = $request->get('syid');
			$semid = $request->get('semid');

			// return $dataid . ' ' . $levelid . ' ' . $tuitiondetailid . ' ' . $itemid . ' ' . $amount . ' ' . $description . ' ';

			$tuitiondetail = db::table('tuitiondetail')
				->where('id', $tuitiondetailid)
				->first();

			$classid = $tuitiondetail->classificationid;
			

			$count = db::table('dpsetup')
				->where('levelid', $levelid)
				->where('classid', $classid)
				->where('tuitionitemid', $dataid)
				->where('syid', $syid)
				->where(function($q) use($levelid, $semid){
					if($levelid == 14 || $levelid == 15)
					{
						if(db::table('schoolinfo')->first()->shssetup == 0)
						{
							$q->where('semid', $semid);
						}
					}
					if($levelid >= 17 && $levelid <= 20)
					{
						$q->where('semid', $semid);
					}
				})
				->where('deleted', 0)
				->count();

			if($count == 0)
			{
				db::table('dpsetup')
					->insert([
						'description' => $description,
						'levelid' => $levelid,
						'classid' => $classid,
						'itemid' => $itemid,
						'amount' => $amount,
						'tuitionitemid' => $dataid,
						'syid' => $syid,
						'semid' => $semid,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);

				return 1;
			}
			else
			{
				return 0;
			}
		}
	}

	public function dpv2_loaddpitems(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$list = '';
			$total = 0;

			// return $syid;

			$dpitems = db::table('dpsetup')
				->select('dpsetup.id', 'items.id as itemid', 'items.description', 'dpsetup.amount')
				->join('items', 'dpsetup.itemid', '=', 'items.id')
				->where('levelid', $levelid)
				->where('syid', $syid)
				->where('semid', $semid)
				->where('dpsetup.deleted', 0)
				->get();

			foreach($dpitems as $item)
			{
				$list .='
					<tr data-id="'.$item->id.'" item-id="'.$item->itemid.'">
						<td>'.$item->description.'</td>
						<td class="text-right">'.number_format($item->amount, 2).'</td>
						<td class="text-center">
							<button class="btn btn-sm btn-edit btn-primary" data-id="'.$item->id.'" data-value="'.$item->amount.'" data-toggle="tooltip" title="Change Amount">
								<i class="fas fa-edit"></i>
							</button>
							<button class="btn btn-sm btn-remove btn-danger" data-id="'.$item->id.'" data-toggle="tooltip" title="Remove">
								<i class="fas fa-trash">
								</i>
							</button>
						</td>
					</tr>
				';

				$total += $item->amount;
			}

			$data = array(
				'list' => $list,
				'total' => number_format($total, 2)
			);

			echo json_encode($data);
		}
	}

	public function dpv2_loaddp(Request $request)
	{
		if($request->ajax())
		{
			$levelid = $request->get('levelid');
			$list = '';
			$syid = $request->get('syid');
			$semid = $request->get('semid');

			$dpsetup = db::table('dpsetup')
				->select(db::raw('dpsetup.id, description, levelname, sum(amount) as amount, levelid, syid, semid'))
				->join('gradelevel', 'dpsetup.levelid', '=', 'gradelevel.id')
				->where('dpsetup.deleted', 0)
				->where('syid', $syid)
				->where(function($q) use($levelid, $semid){
					if($levelid != 0)
					{
						$q->where('levelid', $levelid);
						if($levelid == 14 || $levelid == 15)
						{
							if(db::table('schoolinfo')->first()->shssetup == 0)
							{
								$q->where('semid', $semid);
							}
						}
						if($levelid >= 17 && $levelid <= 20)
						{
							$q->where('semid', $semid);
						}
					}
				})
				->groupBy('levelid', 'syid', 'semid')
				->orderBy('sortid', 'ASC')
				->get();

			foreach($dpsetup as $dp)
			{
				$list .='
					<tr data-id="'.$dp->levelid.'" data-desc="'.$dp->description.'" data-level="'.$dp->levelid.'" data-sy="'.$dp->syid.'" data-sem="'.$dp->semid.'">
						<td>'.$dp->description.'</td>
						<td>'.$dp->levelname.'</td>
						<td>'.number_format($dp->amount, 2).'</td>
					</tr>
				';
			}

			$data = array(
				'list' => $list
			);

			echo json_encode($data);
		}
	}

	public function dpv2_removedpitem(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');

			db::table('dpsetup')
				->where('id', $dataid)
				->update([
					'deleted' => 1,
					'deletedby' => auth()->user()->id,
					'deleteddatetime' => FinanceModel::getServerDateTime()
				]);
		}
	}

	public function dpv2_updatedpitem(Request $request)
	{
		if($request->ajax())
		{
			$dataid = $request->get('dataid');
			$amount = str_replace(',', '', $request->get('amount'));

			db::table('dpsetup')
				->where('id', $dataid)
				->update([
					'amount' => $amount,
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);	
		}
	}
	
	public function ee_save(Request $request)
	{
		if($request->ajax())
		{
			$itemid = $request->get('itemid');

			$item = db::table('items')
				->where('id', $itemid)
				->first();

			$ee_setup = db::table('chrng_earlyenrollmentsetup')
				->first();

			if($ee_setup)
			{
				db::table('chrng_earlyenrollmentsetup')
					->update([
						'classid' => $item->classid,
						'itemid' =>$item->id
					]);
			}
			else
			{
				db::table('chrng_earlyenrollmentsetup')
					->insert([
						'classid' => $item->classid,
						'itemid' =>$item->id
					]);	
			}
		}
	}
	
	public function sigs_load(Request $request)
	{
		$sigid = $request->get('sigid');

		$sigs = db::table('finance_sigs')
			->where('id', $sigid)
			->first();

		if($sigs)
		{
			$data = array(
				'title1' => $sigs->title_1,
				'sig1' => $sigs->sig_1,
				'designation1' =>$sigs->designation_1,
				'title2' => $sigs->title_2,
				'sig2' => $sigs->sig_2,
				'designation2' => $sigs->designation_2,
				'title3' => $sigs->title_3,
				'sig3' => $sigs->sig_3,
				'designation3' => $sigs->designation_3,
				'sigid' => $sigid,
				'sig_active3' => $sigs->sig3
			);

			echo json_encode($data);
		}
	}

	public function sigs_update(Request $request)
	{
		$sigid = $request->get('sigid');
		$title1 = $request->get('title1');
		$sig1 = $request->get('sig1');
		$designation1 = $request->get('designation1');
		$title2 = $request->get('title2');
		$sig2 = $request->get('sig2');
		$designation2 = $request->get('designation2');
		$title3 = $request->get('title3');
		$sig3 = $request->get('sig3');
		$designation3 = $request->get('designation3');

		db::table('finance_sigs')
			->where('id', $sigid)
			->update([
				'title_1' => $title1,
				'sig_1' => $sig1,
				'designation_1' => $designation1,
				'title_2' => $title2,
				'sig_2' => $sig2,
				'designation_2' => $designation2,
				'title_3' => $title3,
				'sig_3' => $sig3,
				'designation_3' => $designation3
			]);

		return 'done';
	}
	
	public function ledgeradj_loadadjinfo(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$syid = $request->get('syid');
			$semid = $request->get('semid');
			$levelid = db::table('studinfo')->where('id', $studid)->first()->levelid;
			$class = '';

			$stud = db::table('studinfo')
				->select('studinfo.id as studid', 'sid', 'lastname', 'firstname', 'lastname', 'middlename', 'levelid', 'levelname', 'grantee.description as grantee', 'strandcode')
				->join('gradelevel', 'studinfo.levelid', '=', 'gradelevel.id')
				->join('grantee', 'studinfo.grantee', '=', 'grantee.id')
				->leftJoin('sh_strand', 'strandid', '=', 'sh_strand.id')
				->where('studinfo.id', $studid)
				->first();

			$scheddetail = db::table('studpayscheddetail')
				->select('classid', 'particulars')
				->where('studid', $studid)
				->where('deleted', 0)
				->where('syid', $syid)
				->where(function($q) use($levelid, $semid){
					if($levelid == 14 || $levelid == 15)
					{
						if(FinanceModel::shssetup() == 0)
						{
							$q->where('semid', $semid);
						}
					}
					if($levelid >= 17 && $levelid <= 20)
					{
						$q->where('semid', $semid);
					}
				})
				->groupBy('classid')
				->get();

			$class .='
				<option value="0">CLASSIFICATION</option>
			';
			foreach($scheddetail as $sched)
			{
				$class .='
					<option value="'.$sched->classid.'">'.$sched->particulars.'</option>
				';
			}
			
			$data = array(
				'name' => $stud->sid . ' - ' . $stud->lastname. ', ' . $stud->firstname . ' ' . $stud->middlename,
				'levelname' => $stud->levelname,
				'grantee' => $stud->grantee,
				'strand' => $stud->strandcode,
				'class' => $class
			);

			echo json_encode($data);
		}
	}
	
	public function ledgeradj_debitsave(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$adjDesc = $request->get('desc');
			$classid = $request->get('classid');
			$amount = str_replace(',', '', $request->get('amount'));
			$mop = $request->get('mop');
			$syid = $request->get('syid');
			$semid = $request->get('semid');


			$levelid = db::table('studinfo')->where('id', $studid)->first()->levelid;

			$adjid = db::table('adjustments')
				->insertGetId([
					'description' => $adjDesc,
					'classid' => $classid,
					'amount' => $amount,
					'mop' => $mop,
					'isdebit' => 1,
					'levelid' => $levelid,
					'syid' => $syid,
					'semid' => $semid,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime(),
					'adjstatus' => 'APPROVED',
				]);

			db::table('adjustmentdetails')
				->insert([
					'headerid' => $adjid,
					'studid' => $studid,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

			db::table('adjustments')
				->where('id', $adjid)
				->update([
					'refnum' => 'ADJ'. date('Y') . sprintf('%05d', $adjid),
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

			//--------studLedger------//
			db::table('studledger')
				->insert([
					'studid' => $studid,
					'syid' => $syid,
					'semid' => $semid,
					'classid' => $classid,
					'particulars' => 'ADJ: ' . $adjDesc,
					'amount' => $amount,
					'ornum' => $adjid,
					'pschemeid' => $mop,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime(),
					'deleted' => 0,
				]);
			//--------studLedger------//

			//-----------------studledgeritemized--------------//
			$checkitemized = db::table('studledgeritemized')
				->where('studid', $studid)
				->where('classificationid', $classid)
				->where('deleted', 0)
				->get();

			if(count($checkitemized) > 0)
			{
				db::table('studledgeritemized')
					->where('id', $checkitemized[0]->id)
					->update([
						'itemamount' => floatval($checkitemized[0]->itemamount) + floatval($amount),
						'updatedby' => auth()->user(),
						'updateddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			else
			{
				db::table('studledgeritemized')
					->insert([
						'studid' => $studid,
						'syid' => $syid,
						'semid' => $semid,
						'classificationid' => $classid,
						'itemamount' => $amount,
						'deleted' => 0,
						'createdby' => auth()->user()->id,
						'createddatetime' => FinanceModel::getServerDateTime()
					]);
			}
			//-----------------studledgeritemized--------------//

			//--------------paymentsched--------------//

			$paymentsetup = db::table('paymentsetup')
				->select('paymentsetup.id', 'noofpayment', 'paymentno', 'duedate')
				->join('paymentsetupdetail', 'paymentsetup.id', '=', 'paymentsetupdetail.paymentid')
				->where('paymentsetup.id', $mop)
				->where('paymentsetupdetail.deleted', 0)
				->get();

			$tAmount = $amount;
			$schedAmount = 0;

			$schedAmount = $amount / intval($paymentsetup[0]->noofpayment);
			$_id = array();

			foreach($paymentsetup as $setup)
			{
				if($tAmount > 0)
				{
					// echo $tAmount . '; ';
					// echo $_id . '; ';
					$sched = db::table('studpayscheddetail')
						->where('studid', $studid)
						->where('classid', $classid)
						->where('deleted', 0)
						->where('syid', $syid)
						->where(function($q) use($levelid, $semid){
							if($levelid == 14 || $levelid == 15)
							{
								if(FinanceModel::shssetup() == 0)
								{
									$q->where('semid', $semid);
								}
							}
							if($levelid >= 17 && $levelid <= 20)
							{
								$q->where('semid', $semid);
							}
						})
						->whereNotIn('id', $_id)
						->take(1)
						->get();



					if(count($sched) > 0)									
					{
						array_push($_id, $sched[0]->id);
						// echo 'studpayscheddetail+: ' . $sched[0]->id . '; ';
						db::table('studpayscheddetail')
							->where('id', $sched[0]->id)
							->update([
								'amount' => $sched[0]->amount + $schedAmount,
								'balance' => $sched[0]->balance + $schedAmount,
								'updatedby' => auth()->user()->id,
								'updateddatetime' => FinanceModel::getServerDateTime(),

							]);
						$tAmount -= $schedAmount;
					}
					else
					{
						// echo 'studpayscheddetail-: ' . $sched[0] . '; ';
						$schedid = db::table('studpayscheddetail')
							->insertGetId([
								'studid' => $studid,
								'syid' => $syid,
								'semid' => $semid,
								'classid' => $classid,
								'particulars' => $adjDesc,
								'duedate' => $setup->duedate,
								'amount' => $schedAmount,
								'balance'=> $schedAmount,
								'createdby' => auth()->user()->id,
								'createddatetime' => FinanceModel::getServerDateTime()
							]);

						$tAmount -= $schedAmount;
						array_push($_id, $schedid);

					}

				}
			}

			//--------------paymentsched--------------//

		}
	}
	
	public function ledgeradj_loadcreditinfo(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');

			$levelid = db::table('studinfo')->where('id', $studid)->first()->levelid;

			$scheddetail = db::table('studpayscheddetail')
				->select(db::raw('particulars, sum(balance) as balance, classid'))
				->where('studid', $studid)
				->where('deleted', 0)
				->where('syid', FinanceModel::getSYID())
				->where(function($q) use($levelid){
					if($levelid == 14 || $levelid == 15)
					{
						if(FinanceModel::shssetup() == 0)
						{
							$q->where('semid', FinanceModel::getSemID());
						}
					}
					if($levelid >= 17 && $levelid <= 20)
					{
						$q->where('semid', FinanceModel::getSemID());
					}
				})
				->groupBy('classid')
				->get();

			$list = '';
			$totalbalance = 0;

			foreach($scheddetail as $sched)
			{
				$totalbalance += $sched->balance;
				$list .='
					<div class="row mt-1" data-id="'.$sched->classid.'">
                      	<div class="col-md-4">
                        	'.$sched->particulars.'
                      	</div>
                      	<div class="col-md-2 text-right credit_balamount" data-id="'.$sched->classid.'">
                        	'.number_format($sched->balance, 2).'
                      	</div>
                      	<div class="col-md-2 text-center">
                        	<input type="text" name="currency-field" pattern="^\$\d{1,3}(,\d{3})*(\.\d+)?$" data-type="currency" autocomplete="off" class="form-control credit_adjamount" style="width: 108px; text-align: right; display: inline-block !important;" placeholder="0.00" data-id="'.$sched->classid.'">
                      	</div>
                    </div>
				';
			}

			$data = array(
				'list' => $list,
				'totalbalance' => number_format($totalbalance, 2)
			);

			echo json_encode($data);
		}
	}

	public function ledgeradj_creditsave(Request $request)
	{
		if($request->ajax())
		{
			$studid = $request->get('studid');
			$adjDesc = $request->get('desc');
			$classid = $request->get('classid');
			$amount = str_replace(',', '', $request->get('amount'));
			$syid = $request->get('syid');
			$semid = $request->get('semid');

			$levelid = db::table('studinfo')->where('id', $studid)->first()->levelid;

			$adjid = db::table('adjustments')
				->insertGetId([
					'description' => $adjDesc,
					'classid' => $classid,
					'amount' => $amount,
					'iscredit' => 1,
					'levelid' => $levelid,
					'syid' => $syid,
					'semid' => $semid,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime(),
					'adjstatus' => 'APPROVED',
				]);

			db::table('adjustmentdetails')
				->insert([
					'headerid' => $adjid,
					'studid' => $studid,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime()
				]);

			db::table('adjustments')
				->where('id', $adjid)
				->update([
					'refnum' => 'ADJ'. date('Y') . sprintf('%05d', $adjid),
					'updatedby' => auth()->user()->id,
					'updateddatetime' => FinanceModel::getServerDateTime()
				]);

			//--------studLedger------//
			db::table('studledger')
				->insert([
					'studid' => $studid,
					'syid' => $syid,
					'semid' => $semid,
					'classid' => $classid,
					'particulars' => 'ADJ: ' . $adjDesc,
					'payment' => $amount,
					'ornum' => $adjid,
					'createdby' => auth()->user()->id,
					'createddatetime' => FinanceModel::getServerDateTime(),
					'deleted' => 0,
				]);
			//--------studLedger------//

			//-----------------studledgeritemized--------------//
			$checkitemized = db::table('studledgeritemized')
				->where('studid', $studid)
				->where('classificationid', $classid)
				->where('deleted', 0)
				->get();

			$iAmount = 0;

			if(count($checkitemized) > 0)
			{
				$iAmount = $amount;
				foreach($checkitemized as $itemized)
				{
					$bal = $itemized->itemamount - $itemized->totalamount;

					if($bal > 0)
					{
						if($iAmount > $bal)
						{
							db::table('studledgeritemized')
								->where('id', $itemized->id)
								->update([
									'totalamount' => $itemized->totalamount + $bal,
									'updatedby' => auth()->user(),
									'updateddatetime' => FinanceModel::getServerDateTime()
								]);		

							$iAmount -= $bal;
						}
						else
						{
							db::table('studledgeritemized')
								->where('id', $itemized->id)
								->update([
									'totalamount' => $itemized->totalamount + $iAmount,
									'updatedby' => auth()->user(),
									'updateddatetime' => FinanceModel::getServerDateTime()
								]);												

							$iAmount = 0;
						}
					}
				}
			}
			//-----------------studledgeritemized--------------//				

			//--------------paymentsched--------------//

			if($classid > 0)
			{
				$paysched = db::table('studpayscheddetail')
					->where('studid', $studid)
					->where('classid', $classid)
					->where('syid', $syid)
					->where('balance', '>', 0)
					->where(function($q) use($levelid, $semid){
						if($levelid == 14 || $levelid == 15)
						{
							if(FinanceModel::shssetup() == 0)
							{
								$q->where('semid', $semid);
							}
						}
						if($levelid >= 17 && $levelid <= 20)
						{
							$q->where('semid', $semid);
						}
					})
					->where('deleted', 0)
					->get();

				$tAmount = $amount;

				if(count($paysched) > 0)
				{
					$_id = array();
					foreach($paysched as $pay)
					{
						if($tAmount > 0)
						{
							if($tAmount > $pay->balance)
							{
								db::table('studpayscheddetail')
									->where('id', $pay->id)
									->update([
										'amountpay' => $pay->amountpay + $pay->balance,
										'balance' => 0,
										'updatedby' => auth()->user()->id,
										'updateddatetime' => FinanceModel::getServerDateTime()
									]);

								$tAmount -= $pay->balance;

							}
							else
							{
								db::table('studpayscheddetail')
									->where('id', $pay->id)
									->update([
										'amountpay' => $pay->amountpay + $tAmount,
										'balance' => $pay->balance - $tAmount,
										'updatedby' => auth()->user()->id,
										'updateddatetime' => FinanceModel::getServerDateTime(),
									]);										

								$tAmount = 0;
							}
						}

						array_push($_id, $pay->id);
					}

					if($tAmount > 0)
					{
						$paysched = db::table('studpayscheddetail')
							->where('studid', $studid)
							->whereNotIn('classid', $_id)
							->where('balance', '>', 0)
							->where('deleted', 0)
							->where('syid', $syid)
							->where(function($q) use($levelid, $semid){
								if($levelid == 14 || $levelid == 15)
								{
									if(FinanceModel::shssetup() == 0)
									{
										$q->where('semid', $semid);
									}
								}
								if($levelid >= 17 && $levelid <= 20)
								{
									$q->where('semid', $semid);
								}
							})
							->get();

						foreach($paysched as $pay)
						{
							if($tAmount > 0)
							{
								if($tAmount > $pay->balance)
								{
									db::table('studpayscheddetail')
										->where('id', $pay->id)
										->update([
											'amountpay' => $pay->amountpay + $pay->balance,
											'balance' => 0,
											'updatedby' => auth()->user()->id,
											'updateddatetime' => FinanceModel::getServerDateTime(),
										]);

									$tAmount -= $pay->balance;

								}
								else
								{
									db::table('studpayscheddetail')
										->where('id', $pay->id)
										->update([
											'amountpay' => $pay->amountpay + $tAmount,
											'balance' => $pay->balance - $tAmount,
											'updatedby' => auth()->user()->id,
											'updateddatetime' => FinanceModel::getServerDateTime(),
										]);										

									$tAmount = 0;
								}	
							}
						}
					}
				}
				else
				{
					$paysched = db::table('studpayscheddetail')
						->where('studid', $studid)
						->where('syid', $syid)
						->where(function($q) use($levelid, $semid){
							if($levelid == 14 || $levelid == 15)
							{
								if(FinanceModel::shssetup() == 0)
								{
									$q->where('semid', $semid);
								}
							}
							if($levelid >= 17 && $levelid <= 20)
							{
								$q->where('semid', $semid);
							}
						})
						->where('balance', '>', 0)
						->where('deleted', 0)
						->get();

					foreach($paysched as $pay)
					{
						if($tAmount > 0)
						{
							if($tAmount > $pay->balance)
							{
								db::table('studpayscheddetail')
									->where('id', $pay->id)
									->update([
										'amountpay' => $pay->amountpay + $pay->balance,
										'balance' => 0,
										'updatedby' => auth()->user()->id,
										'updateddatetime' => FinanceModel::getServerDateTime(),
									]);

								$tAmount -= $pay->balance;

							}
							else
							{
								db::table('studpayscheddetail')
									->where('id', $pay->id)
									->update([
										'amountpay' => $pay->amountpay + $tAmount,
										'balance' => $pay->balance - $tAmount,
										'updatedby' => auth()->user()->id,
										'updateddatetime' => FinanceModel::getServerDateTime(),
									]);										

								$tAmount = 0;
							}	
						}
					}
				}
			}
			else
			{
				$paysched = db::table('studpayscheddetail')
					->where('studid', $studid)
					->where('syid', $syid)
					->where('balance', '>', 0)
					->where(function($q) use($levelid, $semid){
						if($levelid == 14 || $levelid == 15)
						{
							if(FinanceModel::shssetup() == 0)
							{
								$q->where('semid', $semid);
							}
						}
						if($levelid >= 17 && $levelid <= 20)
						{
							$q->where('semid', $semid);
						}
					})
					->where('deleted', 0)
					->orderBy('duedate', 'ASC')
					->get();

				$tAmount = $amount;

				if(count($paysched) > 0)
				{
					foreach($paysched as $pay)
					{
						if($tAmount > 0)
						{
							if($tAmount > $pay->balance)
							{
								db::table('studpayscheddetail')
									->where('id', $pay->id)
									->update([
										'amountpay' => $pay->amountpay + $pay->balance,
										'balance' => 0,
										'updatedby' => auth()->user()->id,
										'updateddatetime' => FinanceModel::getServerDateTime()
									]);

								$tAmount -= $pay->balance;

							}
							else
							{
								db::table('studpayscheddetail')
									->where('id', $pay->id)
									->update([
										'amountpay' => $pay->amountpay + $tAmount,
										'balance' => $pay->balance - $tAmount,
										'updatedby' => auth()->user()->id,
										'updateddatetime' => FinanceModel::getServerDateTime(),
									]);										

								$tAmount = 0;
							}
						}
					}
				}

			}

			//--------------paymentsched--------------//
		}
	}
	
	public function ledger_reminder(Request $request)
	{
		$studid = $request->get('studid');
		$syid = $request->get('syid');
		$semid = $request->get('semid');
		$duedate = $request->get('duedate');
		$action = $request->get('action');

		$stud = db::table('studinfo')
			->select('id', 'lastname', 'firstname', 'middlename', 'levelid')
			->where('id', $studid)
			->first();

		$schoolinfo = db::table('schoolinfo')
			->first();

		$levelid = $stud->levelid;
		$name = $stud->lastname . ', ' . $stud->firstname . ' ' . $stud->middlename;

		$studpaysched = db::table('studpayscheddetail')
			->select(db::raw('particulars, SUM(balance) AS amount, duedate, classid'))
			->where('studid', $studid)
			->where('syid', $syid)
			->where(function($q) use($levelid){
				if($levelid == 14 || $levelid == 15)
				{
					if(FinanceModel::shssetup() == 0)
					{
						$q->where('semid', FinanceModel::getSemID());
					}
				}
				if($levelid >= 17 && $levelid <= 20)
				{
					$q->where('semid', FinanceModel::getSemID());
				}
			})
			->where('deleted', 0)
			->where(function($q) use($duedate){
				$q->whereBetween('duedate', ['2019-01-01', $duedate])
					->orWhereNull('duedate');
			})
			->groupBy('classid')
			->get();

		$assessment = array();
		$oth = array();

		$totalassessment = 0;
		$totaloth = 0;

		foreach($studpaysched as $sched)
		{
			if($sched->classid == 1 || $sched->classid == 2 || $sched->classid == 3)
			{
				array_push($assessment, (object)[
					'particulars' => $sched->particulars,
					'amount' => number_format($sched->amount, 2)
				]);

				$totalassessment += $sched->amount;
			}
			else
			{
				array_push($oth, (object)[
					'particulars' => $sched->particulars,
					'amount' => number_format($sched->amount, 2)
				]);	
				$totaloth += $sched->amount;
			}
		}

		$list = '';

		foreach($assessment as $a)
		{
			$list .='
				<tr>
					<td>'.$a->particulars.'</td>
					<td class="text-right">'.$a->amount.'</td>
				</tr>
			';
		}

		$list .= '
			<tr>
				<td class="text-bold">Total Assessment</td>
				<td class="text-right text-bold">'.number_format($totalassessment, 2).'</td>
			</tr>
		';

		foreach($oth as $o)
		{
			$list .='
				<tr>
					<td>'.$o->particulars.'</td>
					<td class="text-right">'.$o->amount.'</td>
				</tr>
			';
		}

		$list .= '
			<tr>
				<td class="text-bold">Total Assessment</td>
				<td class="text-right text-bold">'.number_format($totaloth, 2).'</td>
			</tr>
		';

		$list .= '
			<tr>
				<td colspan="2" class="text-bold text-right">
					TOTALAMOUNT DUE . '.number_format($totalassessment + $totaloth, 2).'
				</td>
			</tr>
		';

		$data = array(
			'list' => $list,
			'schoolinfo' => $schoolinfo,
			'name' => $name,
			'duedate' => $duedate,
			'assessment' => $assessment,
			'oth' => $oth,
			'totalassessment' => number_format($totalassessment, 2),
			'totaloth' => number_format($totaloth, 2),
			'totaldue' => number_format($totalassessment + $totaloth, 2)
		);

		if($action == 'generate')
		{
			echo json_encode($data);
		}
		else
		{
			$pdf = PDF::loadView('/finance/reports/pdf/pdf_reminderslip', $data)->setPaper('legal','portrait');
			$pdf->getDomPDF()->set_option("enable_php", true);
			return $pdf->stream('Reminder Slip.pdf');
		}
	}
	
	public function ledgeradj_delete(Request $request)
	{
		$dataid = $request->get('dataid');
		$studid = $request->get('studid');
		$syid = $request->get('syid');
		$semid = $request->get('semid');
		$feesid = $request->get('feesid');

		$adj = db::table('adjustmentdetails')
			->where('studid', $studid)
			->where('headerid', $dataid)
			->update([
				'deleted' => 1,
				'deleteddatetime' => FinanceModel::getServerDateTime(),
				'deletedby' => auth()->user()->id
			]);

		UtilityController::resetpayment_v3($request);
	}

	public function ledgerdiscount_delete(Request $request)
	{
		$dataid = $request->get('dataid');
		$studid = $request->get('studid');
		$syid = $request->get('syid');
		$semid = $request->get('semid');
		$feesid = $request->get('feesid');

		$adj = db::table('studdiscounts')
			->where('id', $dataid)
			->update([
				'deleted' => 1,
				'deleteddatetime' => FinanceModel::getServerDateTime(),
				'deletedby' => auth()->user()->id
			]);

		UtilityController::resetpayment_v3($request);
	}
	
	public function ledgeroa_delete(Request $request)
	{
		$dataid = $request->get('dataid');
		$studid = $request->get('studid');
		$syid = $request->get('syid');
		$semid = $request->get('semid');
		$feesid = $request->get('feesid');

		$adj = db::table('studledger')
			->where('id', $dataid)
			->update([
				'deleted' => 1,
				'deleteddatetime' => FinanceModel::getServerDateTime(),
				'deletedby' => auth()->user()->id
			]);

		UtilityController::resetpayment_v3($request);
	}


}

